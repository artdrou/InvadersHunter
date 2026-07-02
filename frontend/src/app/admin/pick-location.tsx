import { useRef, useState , useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapView, Camera, ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import type { CameraRef, MapViewRef } from '@maplibre/maplibre-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { ButtonFont, ButtonFontSize, FontSize } from '@/constants/theme';
import { useAdminPickerStore } from '@/features/admin/store';
import { fetchAdminSubmissions } from '@/features/admin/services/admin.api';

import type { AdminSubmission } from '@/features/admin/types';

const MAP_STYLES: Record<string, string> = {
  dark:  'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/liberty',
  blue:  'https://api.maptiler.com/maps/019d4e3d-65da-75e0-8ed5-e0c944618e3a/style.json?key=boZ0TjiM2vOJbp9YnFsp',
};

export default function AdminPickLocationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, themeName, appFont } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    adminRequestId: string;
    baryLat: string;
    baryLon: string;
    currentLat: string;
    currentLon: string;
  }>();

  const baryLat    = parseFloat(params.baryLat);
  const baryLon    = parseFloat(params.baryLon);
  const currentLat = parseFloat(params.currentLat);
  const currentLon = parseFloat(params.currentLon);
  const hasCurrentPos = !isNaN(currentLat) && !isNaN(currentLon);
  const setPickedCoords = useAdminPickerStore((s) => s.setPickedCoords);

  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const mapViewRef  = useRef<MapViewRef>(null);
  const mapSizeRef  = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const cameraRef  = useRef<CameraRef>(null);

  useEffect(() => {
    fetchAdminSubmissions(Number(params.adminRequestId))
      .then(setSubs)
      .catch(() => {});
  }, [params.adminRequestId]);

  // GeoJSON for proposed positions (white dots)
  const proposedGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: subs
      .filter((s) => s.proposed_latitude !== null && s.proposed_longitude !== null)
      .map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.proposed_longitude!, s.proposed_latitude!] },
        properties: { id: s.id },
      })),
  };

  // GeoJSON for current invader position (red dot)
  const currentGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: hasCurrentPos ? [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [currentLon, currentLat] },
      properties: {},
    }] : [],
  };

  // GeoJSON for barycenter (accent dot)
  const baryGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [baryLon, baryLat] },
      properties: {},
    }],
  };

  async function handleValidate() {
    const { width, height } = mapSizeRef.current;
    const center = await mapViewRef.current?.getCoordinateFromView([width / 2, height / 2]);
    if (center) {
      setPickedCoords({ lon: center[0], lat: center[1] });
    }
    router.back();
  }

  function handleCancel() {
    router.back();
  }

  const mapStyle = MAP_STYLES[themeName] ?? MAP_STYLES.dark;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapViewRef}
        style={styles.map}
        mapStyle={mapStyle}
        attributionPosition={{ bottom: 8, left: 8 }}
        {...{ onLayout: (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
          const { width, height } = e.nativeEvent.layout;
          mapSizeRef.current = { width, height };
        } } as any}
      >
        <Camera
          ref={cameraRef}
          centerCoordinate={[baryLon, baryLat]}
          zoomLevel={16}
          animationDuration={0}
        />

        {/* Current invader position */}
        {hasCurrentPos && (
          <ShapeSource id="current" shape={currentGeoJSON}>
            <CircleLayer
              id="current-circle"
              style={{
                circleRadius: 10,
                circleColor: theme.danger,
                circleOpacity: 0.9,
                circleStrokeWidth: 2,
                circleStrokeColor: theme.bg,
              }}
            />
          </ShapeSource>
        )}

        {/* Individual proposed positions */}
        {proposedGeoJSON.features.length > 0 && (
          <ShapeSource id="proposed" shape={proposedGeoJSON}>
            <CircleLayer
              id="proposed-circles"
              style={{
                circleRadius: 8,
                circleColor: '#ffffff',
                circleOpacity: 0.7,
                circleStrokeWidth: 1,
                circleStrokeColor: '#888888',
              }}
            />
          </ShapeSource>
        )}

        {/* Barycenter */}
        <ShapeSource id="bary" shape={baryGeoJSON}>
          <CircleLayer
            id="bary-circle"
            style={{
              circleRadius: 12,
              circleColor: theme.accent,
              circleOpacity: 0.9,
              circleStrokeWidth: 2,
              circleStrokeColor: theme.bg,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Center crosshair — where the admin's pick lands */}
      <View style={styles.pinWrapper} pointerEvents="none">
        <View style={[styles.pin, { backgroundColor: theme.accent, borderColor: theme.bg }]} />
        <View style={[styles.pinStem, { backgroundColor: theme.accent }]} />
      </View>

      {/* Legend */}
      <View style={[styles.legend, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
        {hasCurrentPos && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
            <Text style={[styles.legendText, { fontFamily: appFont, color: theme.textMuted }]}>{t('admin.legendCurrent')}</Text>
          </View>
        )}
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#ffffff', opacity: 0.8 }]} />
          <Text style={[styles.legendText, { fontFamily: appFont, color: theme.textMuted }]}>{t('admin.legendProposed')}</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.legendText, { fontFamily: appFont, color: theme.textMuted }]}>{t('admin.legendBarycenter')}</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={[styles.bar, { bottom: 32 + insets.bottom }]}>
        <Pressable
          style={({ pressed }) => [styles.btn, { borderColor: theme.border, backgroundColor: theme.bgElement }, pressed && styles.pressed]}
          onPress={handleCancel}
        >
          <Text style={[styles.btnText, { color: theme.textMuted, fontFamily: ButtonFont }]}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, { backgroundColor: theme.accent }, pressed && styles.pressed]}
          onPress={handleValidate}
        >
          <Text style={[styles.btnText, { color: theme.bg, fontFamily: ButtonFont }]}>{t('common.validatePosition')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  pinWrapper: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  pin: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginBottom: 18,
  },
  pinStem: {
    position: 'absolute', width: 2, height: 10, top: '50%', marginTop: -1,
  },
  legend: {
    position: 'absolute', top: 20, right: 16,
    borderRadius: 8, borderWidth: 1, padding: 10, gap: 6, zIndex: 10,
  },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:  { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: FontSize.xs },
  bar: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', gap: 12, zIndex: 20,
  },
  btn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: 'transparent', alignItems: 'center',
  },
  btnText:  { fontSize: ButtonFontSize.xl },
  pressed:  { opacity: 0.7 },
});
