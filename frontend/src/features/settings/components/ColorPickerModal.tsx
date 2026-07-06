import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { tap as hapticTap } from '../haptics';

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
            {onReset && (
              <Pressable
                style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}
                onPress={() => { hapticTap(); onReset(); onClose(); }}
              >
                <Text style={styles.modalSecondaryText}>{t('profile.resetAccent')}</Text>
              </Pressable>
            )}
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

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
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
    modalTitle: { fontFamily: ButtonFont, fontSize: FontSize.xl, letterSpacing: 1 },
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
    modalSecondaryBtn: {
      flex: 1, paddingVertical: 12, alignItems: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    modalSecondaryText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    modalPrimaryBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: BorderRadius.sm },
    modalPrimaryText: { color: t.bg, fontFamily: ButtonFont, fontSize: FontSize.md },
  });
}
