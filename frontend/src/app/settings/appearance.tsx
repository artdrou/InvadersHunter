import { useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { themes, type ThemeName, type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, useAppearanceStore, CLUSTER_MAX_ZOOM_MIN, CLUSTER_MAX_ZOOM_MAX, ColorPickerModal } from '@/features/settings';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const {
    theme, themeName, setTheme,
    accentOverride, setAccentOverride,
    routePathOverride, setRoutePathOverride,
  } = useTheme();
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

  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [routePickerOpen, setRoutePickerOpen]   = useState(false);

  return (
    <SettingsShell title={t('settings.appearance')}>

      {/* ── Theme ── */}
      <Text style={styles.subcategoryLabel}>{t('appearance.sectionTheme')}</Text>

      {/* Theme selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.theme')}</Text>
        <View style={styles.row}>
          {(Object.keys(themes) as ThemeName[]).map((name) => {
            const isActive = name === themeName;
            return (
              <Pressable
                key={name}
                style={({ pressed }) => [
                  styles.option,
                  isActive && { borderColor: theme.accent },
                  pressed && styles.pressed,
                ]}
                onPress={() => { hapticTap(); setTheme(name); }}
              >
                <Text style={[styles.optionText, isActive && { color: theme.accent }]}>
                  {t(`themeNames.${name}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Accent color */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.accentColor')}</Text>
        <View style={styles.swatchRow2}>
          <Pressable
            style={({ pressed }) => [
              styles.accentSwatch,
              { backgroundColor: theme.accent, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
            onPress={() => { hapticTap(); setAccentPickerOpen(true); }}
          />
          {accentOverride && (
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
              onPress={() => { hapticTap(); setAccentOverride(null); }}
            >
              <Text style={styles.resetBtnText}>{t('profile.resetAccent')}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Route path color */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile.routeColor')}</Text>
        <View style={styles.swatchRow2}>
          <Pressable
            style={({ pressed }) => [
              styles.accentSwatch,
              { backgroundColor: theme.routePath, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
            onPress={() => { hapticTap(); setRoutePickerOpen(true); }}
          />
          {routePathOverride && (
            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
              onPress={() => { hapticTap(); setRoutePathOverride(null); }}
            >
              <Text style={styles.resetBtnText}>{t('profile.resetAccent')}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Hunt ── */}
      <Text style={[styles.subcategoryLabel, styles.subcategoryLabelSpaced]}>{t('appearance.sectionHunt')}</Text>

      {/* Route glow toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabel}>
          <Text style={styles.toggleText}>{t('appearance.routeGlow')}</Text>
          <Text style={styles.toggleSubtitle}>{t('appearance.routeGlowSubtitle')}</Text>
        </View>
        <Switch
          value={routeGlowEnabled}
          onValueChange={(v) => { hapticTap(); setRouteGlowEnabled(v); }}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.bgElement}
        />
      </View>

      {/* ── Map ── */}
      <Text style={[styles.subcategoryLabel, styles.subcategoryLabelSpaced]}>{t('appearance.sectionMap')}</Text>

      {/* Clustering toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabel}>
          <Text style={styles.toggleText}>{t('appearance.clustering')}</Text>
          <Text style={styles.toggleSubtitle}>{t('appearance.clusteringSubtitle')}</Text>
        </View>
        <Switch
          value={clusteringEnabled}
          onValueChange={(v) => { hapticTap(); setClusteringEnabled(v); }}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.bgElement}
        />
      </View>

      {/* Clustering zoom threshold — only relevant while clustering is on */}
      {clusteringEnabled && (
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleText}>{t('appearance.clusterZoom')}</Text>
            <Text style={styles.toggleSubtitle}>{t('appearance.clusterZoomSubtitle')}</Text>
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

      {/* Lite map toggle — leaner layers for smoother panning on low-end devices */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabel}>
          <Text style={styles.toggleText}>{t('appearance.mapLite')}</Text>
          <Text style={styles.toggleSubtitle}>{t('appearance.mapLiteSubtitle')}</Text>
        </View>
        <Switch
          value={mapLiteEnabled}
          onValueChange={(v) => { hapticTap(); setMapLiteEnabled(v); }}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor={theme.bgElement}
        />
      </View>

      {/* POI + 3D toggles — irrelevant in Lite mode, so hidden there */}
      {!mapLiteEnabled && (
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleText}>{t('appearance.mapPoi')}</Text>
            <Text style={styles.toggleSubtitle}>{t('appearance.mapPoiSubtitle')}</Text>
          </View>
          <Switch
            value={mapPoiEnabled}
            onValueChange={(v) => { hapticTap(); setMapPoiEnabled(v); }}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.bgElement}
          />
        </View>
      )}

      {!mapLiteEnabled && (
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleText}>{t('appearance.map3d')}</Text>
            <Text style={styles.toggleSubtitle}>{t('appearance.map3dSubtitle')}</Text>
          </View>
          <Switch
            value={map3dBuildings}
            onValueChange={(v) => { hapticTap(); setMap3dBuildings(v); }}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.bgElement}
          />
        </View>
      )}

      {/* Accent color picker modal */}
      <ColorPickerModal
        visible={accentPickerOpen}
        title={t('profile.accentColor')}
        currentColor={theme.accent}
        onClose={() => setAccentPickerOpen(false)}
        onValidate={setAccentOverride}
        onReset={() => setAccentOverride(null)}
      />

      {/* Route path color picker modal */}
      <ColorPickerModal
        visible={routePickerOpen}
        title={t('profile.routeColor')}
        currentColor={theme.routePath}
        onClose={() => setRoutePickerOpen(false)}
        onValidate={setRoutePathOverride}
        onReset={() => setRoutePathOverride(null)}
      />
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    subcategoryLabel: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    subcategoryLabelSpaced: { marginTop: Spacing.two },
    section:      { gap: Spacing.two },
    sectionLabel: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: FontSize.sm,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    row:    { flexDirection: 'row', gap: Spacing.two },
    option: {
      flex: 1, paddingVertical: 10,
      alignItems: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1,
      borderColor: t.border, backgroundColor: t.bgElement,
    },
    optionText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    pressed:    { opacity: 0.6 },
    swatchRow2: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    accentSwatch: { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },
    resetBtn: {
      paddingVertical: 8, paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    resetBtnText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },

    // Toggle row (matches haptics.tsx style)
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: t.bgElement,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: BorderRadius.md,
      padding: Spacing.three,
    },
    toggleLabel:    { flex: 1, gap: 4 },
    toggleText:     { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    toggleSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20 },

    // Stepper (−/+ around a numeric value)
    stepper:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1,
      borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnDisabled: { opacity: 0.35 },
    stepperBtnText:     { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.xl, lineHeight: 24 },
    stepperValue: {
      minWidth: 28, textAlign: 'center',
      color: t.text, fontFamily: ButtonFont, fontSize: FontSize.lg,
    },
  });
}
