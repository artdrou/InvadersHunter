import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFontBold, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';
import { tap as hapticTap } from '../haptics';
import { HsvMap, HsvSliders } from './HsvSliders';
import { ArcadeSegmented } from '@/components/ArcadeSegmented';
import { hexToHsv, hsvToHex, type Hsv } from '../hsv';

// 5x5 neon palette — rows follow the visible spectrum — then a row of greys.
const COLOR_SWATCH_ROWS: readonly (readonly string[])[] = [
  ['#ff0033', '#ff3300', '#ff6600', '#ff8800', '#ffaa00'],
  ['#ffcc00', '#ffe000', '#ffff00', '#eeff00', '#ccff00'],
  ['#88ff00', '#00ff00', '#00ff66', '#00ffaa', '#00ffcc'],
  ['#00ffff', '#00ddff', '#00aaff', '#0077ff', '#0044ff'],
  ['#4400ff', '#8800ff', '#cc00ff', '#ff00cc', '#ff0088'],
  ['#ffffff', '#c8c8c8', '#909090', '#585858', '#202020'],
] as const;

function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(hex);
}

type Props = {
  visible: boolean;
  title: string;
  currentColor: string;
  onClose: () => void;
  onValidate: (hex: string) => void;
  onReset?: () => void;
};

export function ColorPickerModal({ visible, title, currentColor, onClose, onValidate, onReset }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Two pickers, one per tab, each with its own color; Validate takes the active
  // tab's. A Basic pick also resets Advanced to it (pick a swatch, then tweak it),
  // never the other way. The hex field and preview belong to Advanced.
  const [tab, setTab] = useState<'basic' | 'advanced'>('basic');
  const [basicDraft, setBasicDraft] = useState(currentColor);
  const [advancedDraft, setAdvancedDraft] = useState(currentColor);
  // Kept apart from the hex: a grey has no hue, so dragging saturation back up keeps the chosen one
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(isValidHex(currentColor) ? currentColor : '#ffffff'));

  function handleOpen() {
    setBasicDraft(currentColor);
    setAdvancedDraft(currentColor);
    if (isValidHex(currentColor)) setHsv(hexToHsv(currentColor));
  }

  function pickHsv(next: Hsv) {
    setHsv(next);
    setAdvancedDraft(hsvToHex(next));
  }

  function setAdvancedHex(hex: string) {
    setAdvancedDraft(hex);
    if (isValidHex(hex)) setHsv(hexToHsv(hex));
  }

  function pickBasic(hex: string) {
    setBasicDraft(hex);
    if (isValidHex(hex)) setAdvancedHex(hex);
  }

  const draft = tab === 'basic' ? basicDraft : advancedDraft;
  const previewColor = isValidHex(advancedDraft) ? advancedDraft : currentColor;

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
          <ShadowText shadowColor={theme.titleShadow} style={styles.modalTitle}>{title}</ShadowText>

          <ArcadeSegmented
            stretch
            options={[
              { value: 'basic' as const, label: t('colorPicker.basic') },
              { value: 'advanced' as const, label: t('colorPicker.advanced') },
            ]}
            value={tab}
            onChange={(v) => { hapticTap(); setTab(v); }}
          />

          {tab === 'advanced' ? (
          <>
            <HsvMap hsv={hsv} onChange={pickHsv} />
            <HsvSliders hsv={hsv} onChange={pickHsv} />
            <View style={styles.hexRow}>
              <View style={[styles.hexPreview, { backgroundColor: previewColor, borderColor: theme.border }]} />
              <TextInput
                style={styles.hexInput}
                value={advancedDraft}
                onChangeText={(v) => setAdvancedHex(v.startsWith('#') ? v : '#' + v)}
                placeholder="#RRGGBB"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={7}
              />
            </View>
          </>
          ) : (
          <View style={styles.swatchGrid}>
            {COLOR_SWATCH_ROWS.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.swatchRow}>
                {row.map((hex) => {
                  const isActive = hex.toLowerCase() === basicDraft.toLowerCase();
                  return (
                    <Pressable
                      key={hex}
                      onPress={() => { hapticTap(); pickBasic(hex); }}
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
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}
              onPress={() => { hapticTap(); onClose(); }}
            >
              <ShadowText shadowColor={theme.titleShadow} style={styles.modalSecondaryText} numberOfLines={1}>{t('common.cancel')}</ShadowText>
            </Pressable>
            {onReset && (
              <Pressable
                style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}
                onPress={() => { hapticTap(); onReset(); onClose(); }}
              >
                <ShadowText shadowColor={theme.titleShadow} style={styles.modalSecondaryText} numberOfLines={1}>{t('profile.resetAccent')}</ShadowText>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
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

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center', alignItems: 'center', padding: Spacing.four,
    },
    modalCard: {
      width: '100%', maxWidth: 360,
      ...arcadeCard(t),
      padding: Spacing.four, gap: Spacing.three,
    },
    modalTitle: { color: t.accent, fontFamily: ButtonFontBold, fontSize: FontSize.xl, letterSpacing: 1 },
    swatchGrid: { gap: Spacing.one },
    swatchRow: { flexDirection: 'row', gap: Spacing.one },
    swatch: { flex: 1, aspectRatio: 1, borderRadius: BorderRadius.sm, borderWidth: 2 },
    swatchActive: { borderWidth: 3 },
    hexRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
    hexPreview: { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },
    hexInput: {
      flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      backgroundColor: t.bg, color: t.text,
      paddingVertical: 10, paddingHorizontal: Spacing.three,
      fontSize: FontSize.md,
    },
    modalActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
    // Arcade buttons (as on the settings screens): outline secondaries, filled Validate
    modalSecondaryBtn: {
      flex: 1, paddingVertical: 12, alignItems: 'center',
      borderRadius: BorderRadius.sm, ...arcadeButton(t, 'outline'),
    },
    modalSecondaryText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
    modalPrimaryBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.sm, ...arcadeButton(t) },
    modalPrimaryText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
  });
}
