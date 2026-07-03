import { useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { themes, type ThemeName, type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, useAppearanceStore, CLUSTER_MAX_ZOOM_MIN, CLUSTER_MAX_ZOOM_MAX } from '@/features/settings';

// 5x5 neon palette — rows follow the visible spectrum.
const COLOR_SWATCH_ROWS: readonly (readonly string[])[] = [
  ['#ff0033', '#ff3300', '#ff6600', '#ff8800', '#ffaa00'],
  ['#ffcc00', '#ffe000', '#ffff00', '#eeff00', '#ccff00'],
  ['#88ff00', '#00ff00', '#00ff66', '#00ffaa', '#00ffcc'],
  ['#00ffff', '#00ddff', '#00aaff', '#0077ff', '#0044ff'],
  ['#4400ff', '#8800ff', '#cc00ff', '#ff00cc', '#ff0088'],
] as const;

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(hex);
}

type PickerModalProps = {
  visible: boolean
  title: string
  currentColor: string
  onClose: () => void
  onValidate: (hex: string) => void
  onReset: () => void
  theme: ThemeTokens
  styles: ReturnType<typeof makeStyles>
}

function ColorPickerModal({ visible, title, currentColor, onClose, onValidate, onReset, theme, styles }: PickerModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(currentColor);

  function handleOpen() { setDraft(currentColor); }

  const previewColor = isValidHex(draft) ? draft : currentColor;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={[styles.modalTitle, { color: previewColor }]}>{title}</Text>

          <View style={styles.swatchGrid}>
            {COLOR_SWATCH_ROWS.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.swatchRow}>
                {row.map((hex) => {
                  const isActive = hex.toLowerCase() === draft.toLowerCase();
                  return (
                    <Pressable
                      key={hex}
                      onPress={() => { hapticTap(); setDraft(hex); }}
                      style={({ pressed }) => [
                        styles.swatch,
                        { backgroundColor: hex, borderColor: isActive ? theme.text : theme.border },
                        isActive && styles.swatchActive,
                        pressed && styles.pressed,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.hexRow}>
            <View style={[styles.hexPreview, { backgroundColor: previewColor, borderColor: theme.border }]} />
            <TextInput
              style={styles.hexInput}
              value={draft}
              onChangeText={(v) => setDraft(v.startsWith('#') ? v : '#' + v)}
              placeholder="#RRGGBB"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}
              onPress={() => { hapticTap(); onClose(); }}
            >
              <Text style={styles.modalSecondaryText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}
              onPress={() => { hapticTap(); onReset(); onClose(); }}
            >
              <Text style={styles.modalSecondaryText}>{t('profile.resetAccent')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { backgroundColor: previewColor },
                pressed && styles.pressed,
                !isValidHex(draft) && { opacity: 0.4 },
              ]}
              disabled={!isValidHex(draft)}
              onPress={() => { hapticTap(); if (isValidHex(draft)) { onValidate(draft); onClose(); } }}
            >
              <Text style={styles.modalPrimaryText}>{t('common.validate')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
        theme={theme}
        styles={styles}
      />

      {/* Route path color picker modal */}
      <ColorPickerModal
        visible={routePickerOpen}
        title={t('profile.routeColor')}
        currentColor={theme.routePath}
        onClose={() => setRoutePickerOpen(false)}
        onValidate={setRoutePathOverride}
        onReset={() => setRoutePathOverride(null)}
        theme={theme}
        styles={styles}
      />
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    subcategoryLabel: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.md,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    subcategoryLabelSpaced: { marginTop: Spacing.two },
    section:      { gap: Spacing.two },
    sectionLabel: {
      color: t.textMuted,
      fontFamily: ButtonFont,
      fontSize: ButtonFontSize.sm,
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
    optionText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.md },
    pressed:    { opacity: 0.6 },
    swatchRow2: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    accentSwatch: { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },
    resetBtn: {
      paddingVertical: 8, paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    resetBtnText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.md },

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
    toggleText:     { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg },
    toggleSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.sm, lineHeight: 20 },

    // Stepper (−/+ around a numeric value)
    stepper:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1,
      borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnDisabled: { opacity: 0.35 },
    stepperBtnText:     { color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.xl, lineHeight: 24 },
    stepperValue: {
      minWidth: 28, textAlign: 'center',
      color: t.text, fontFamily: ButtonFont, fontSize: ButtonFontSize.lg,
    },

    // Modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center', alignItems: 'center', padding: Spacing.four,
    },
    modalCard: {
      width: '100%', maxWidth: 360,
      backgroundColor: t.bgElement,
      borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: t.border,
      padding: Spacing.four, gap: Spacing.three,
    },
    modalTitle:  { fontFamily: ButtonFont, fontSize: ButtonFontSize.xl, letterSpacing: 1 },
    swatchGrid:  { gap: Spacing.one },
    swatchRow:   { flexDirection: 'row', gap: Spacing.one },
    swatch:      { flex: 1, aspectRatio: 1, borderRadius: BorderRadius.sm, borderWidth: 2 },
    swatchActive:{ borderWidth: 3 },
    hexRow:      { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
    hexPreview:  { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },
    hexInput: {
      flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      backgroundColor: t.bg, color: t.text,
      paddingVertical: 10, paddingHorizontal: Spacing.three,
      fontSize: FontSize.md,
    },
    modalActions:      { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
    modalSecondaryBtn: {
      flex: 1, paddingVertical: 12, alignItems: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    modalSecondaryText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: ButtonFontSize.md },
    modalPrimaryBtn:    { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.sm },
    modalPrimaryText:   { color: t.bg, fontFamily: ButtonFont, fontSize: ButtonFontSize.md },
  });
}
