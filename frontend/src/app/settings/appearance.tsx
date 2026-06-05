import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { themes, type ThemeName, type ThemeTokens, ButtonFont, ButtonFontSize, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsShell, hapticTap } from '@/features/settings';

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
    accentOverride, setAccentOverride, defaultAccent,
    routePathOverride, setRoutePathOverride, defaultRoutePath,
  } = useTheme();
  const styles = makeStyles(theme);

  const [accentPickerOpen, setAccentPickerOpen]     = useState(false);
  const [routePickerOpen, setRoutePickerOpen]       = useState(false);

  return (
    <SettingsShell title={t('settings.appearance')}>
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
      fontSize: 16,
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
