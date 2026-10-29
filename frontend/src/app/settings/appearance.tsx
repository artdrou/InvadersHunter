import { ArcadeSegmented } from '@/components/ArcadeSegmented';
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, ButtonFontBold, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { arcadeRowDivider } from '@/constants/arcade-button';
import { ArcadeSectionLabel } from '@/components/ArcadeSectionLabel';
import {
  SettingsShell, SettingsSection, SettingsToggleRow, ThemePicker,
  hapticTap, useAppearanceStore, CLUSTER_MAX_ZOOM_MIN, CLUSTER_MAX_ZOOM_MAX,
} from '@/features/settings';
import { SettingsRowIcon } from '@/features/settings/components/SettingsRow';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const routeGlowEnabled    = useAppearanceStore((s) => s.routeGlowEnabled);
  const setRouteGlowEnabled = useAppearanceStore((s) => s.setRouteGlowEnabled);

  const clusteringEnabled    = useAppearanceStore((s) => s.clusteringEnabled);
  const setClusteringEnabled = useAppearanceStore((s) => s.setClusteringEnabled);
  const clusterMaxZoom       = useAppearanceStore((s) => s.clusterMaxZoom);
  const setClusterMaxZoom    = useAppearanceStore((s) => s.setClusterMaxZoom);
  const mapPoiEnabled        = useAppearanceStore((s) => s.mapPoiEnabled);
  const setMapPoiEnabled     = useAppearanceStore((s) => s.setMapPoiEnabled);
  const mapLiteEnabled       = useAppearanceStore((s) => s.mapLiteEnabled);
  const setMapLiteEnabled    = useAppearanceStore((s) => s.setMapLiteEnabled);
  const map3dBuildings       = useAppearanceStore((s) => s.map3dBuildingsEnabled);
  const setMap3dBuildings    = useAppearanceStore((s) => s.setMap3dBuildingsEnabled);

  const [tab, setTab] = useState<'theme' | 'map'>('theme');

  const toggle = (set: (v: boolean) => void) => (v: boolean) => { hapticTap(); set(v); };

  return (
    <SettingsShell title={t('settings.appearance')} centered={false}>
      <ArcadeSegmented
        stretch
        options={[
          { value: 'theme' as const, label: t('appearance.sectionTheme') },
          { value: 'map' as const, label: t('appearance.sectionMap') },
        ]}
        value={tab}
        onChange={(v) => { hapticTap(); setTab(v); }}
      />

      {tab === 'theme' && (
        <View style={styles.section}>
          <ArcadeSectionLabel title={t('appearance.sectionTheme')} />
          <ThemePicker />
        </View>
      )}

      {tab === 'map' && (
        <SettingsSection title={t('appearance.sectionMap')}>
          {/* Hunt route glow (drawn on the map) */}
          <SettingsToggleRow
            icon="flash-outline"
            label={t('appearance.routeGlow')}
            subtitle={t('appearance.routeGlowSubtitle')}
            value={routeGlowEnabled}
            onValueChange={toggle(setRouteGlowEnabled)}
          />

          <SettingsToggleRow
            icon="git-merge-outline"
            label={t('appearance.clustering')}
            subtitle={t('appearance.clusteringSubtitle')}
            value={clusteringEnabled}
            onValueChange={toggle(setClusteringEnabled)}
          />

          {/* Clustering zoom threshold — only relevant while clustering is on */}
          {clusteringEnabled && (
            <View style={styles.row}>
              <SettingsRowIcon icon="search-outline" />
              <View style={styles.labelWrap}>
                <Text style={styles.label}>{t('appearance.clusterZoom')}</Text>
                <Text style={styles.subtitle}>{t('appearance.clusterZoomSubtitle')}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    clusterMaxZoom <= CLUSTER_MAX_ZOOM_MIN && styles.stepperBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={clusterMaxZoom <= CLUSTER_MAX_ZOOM_MIN}
                  onPress={() => { hapticTap(); setClusterMaxZoom(clusterMaxZoom - 1); }}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{clusterMaxZoom}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    clusterMaxZoom >= CLUSTER_MAX_ZOOM_MAX && styles.stepperBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={clusterMaxZoom >= CLUSTER_MAX_ZOOM_MAX}
                  onPress={() => { hapticTap(); setClusterMaxZoom(clusterMaxZoom + 1); }}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Lite map — leaner layers for smoother panning on low-end devices */}
          <SettingsToggleRow
            icon="speedometer-outline"
            label={t('appearance.mapLite')}
            subtitle={t('appearance.mapLiteSubtitle')}
            value={mapLiteEnabled}
            onValueChange={toggle(setMapLiteEnabled)}
          />

          {/* POI + 3D — irrelevant in Lite mode, so hidden there */}
          {!mapLiteEnabled && (
            <SettingsToggleRow
              icon="storefront-outline"
              label={t('appearance.mapPoi')}
              subtitle={t('appearance.mapPoiSubtitle')}
              value={mapPoiEnabled}
              onValueChange={toggle(setMapPoiEnabled)}
            />
          )}
          {!mapLiteEnabled && (
            <SettingsToggleRow
              icon="cube-outline"
              label={t('appearance.map3d')}
              subtitle={t('appearance.map3dSubtitle')}
              value={map3dBuildings}
              onValueChange={toggle(setMap3dBuildings)}
            />
          )}
        </SettingsSection>
      )}
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    // Same label as SettingsSection's (the theme picker brings its own cards)
    section: { gap: Spacing.two },
    pressed: { opacity: 0.6 },

    // Row matching SettingsToggleRow, with a stepper instead of a switch
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two + 2,
      ...arcadeRowDivider(t),
    },
    labelWrap: { flex: 1, gap: 2 },
    label: { color: t.text, fontFamily: ButtonFontBold, fontSize: FontSize.md },
    subtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },

    // Stepper (−/+ around a numeric value)
    stepper:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 2,
      borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnDisabled: { opacity: 0.35 },
    stepperBtnText:     { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.xl, lineHeight: 24 },
    stepperValue: {
      minWidth: 24, textAlign: 'center',
      color: t.text, fontFamily: ButtonFont, fontSize: FontSize.lg,
    },
  });
}
