import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import {
  SettingsShell, SettingsSection, SettingsToggleRow, ThemePicker,
  hapticTap, useAppearanceStore, CLUSTER_MAX_ZOOM_MIN, CLUSTER_MAX_ZOOM_MAX,
} from '@/features/settings';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
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

  const toggle = (set: (v: boolean) => void) => (v: boolean) => { hapticTap(); set(v); };

  return (
    <SettingsShell title={t('settings.appearance')}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('appearance.sectionTheme')}</Text>
        <ThemePicker />
      </View>

      <SettingsSection title={t('appearance.sectionHunt')}>
        <SettingsToggleRow
          icon="flash-outline"
          label={t('appearance.routeGlow')}
          subtitle={t('appearance.routeGlowSubtitle')}
          value={routeGlowEnabled}
          onValueChange={toggle(setRouteGlowEnabled)}
        />
      </SettingsSection>

      <SettingsSection title={t('appearance.sectionMap')}>
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
            <Ionicons name="search-outline" size={20} color={theme.accent} style={styles.icon} />
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
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    // Same label as SettingsSection's (the theme picker brings its own cards)
    section: { gap: Spacing.one },
    sectionLabel: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
      paddingHorizontal: Spacing.two,
    },
    pressed: { opacity: 0.6 },

    // Row matching SettingsToggleRow, with a stepper instead of a switch
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.bgDivider,
    },
    icon: { width: 24, textAlign: 'center' },
    labelWrap: { flex: 1, gap: 2 },
    label: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    subtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },

    // Stepper (−/+ around a numeric value)
    stepper:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1,
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
