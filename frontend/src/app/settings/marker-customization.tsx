import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, ColorPickerModal, useMarkerCustomizationStore } from '@/features/settings';
import { SHAPE_IDS } from '@/features/marker-customization/shapes';
import { renderMarkerBase64 } from '@/features/marker-customization/generate-markers';
import { TIER_VALUES, type TierPts, type CustomizableState } from '@/features/marker-customization/types';

const THUMB_SIZE = 56;
const PREVIEW_SIZE = 112;
const OPACITY_STEP = 0.05;

const STATE_ORDER: CustomizableState[] = ['flashCaptured', 'flashUncaptured', 'highlight', 'grey'];

function dataUri(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

// Rasterizing happens synchronously during render (useMemo). renderMarkerBase64
// throws if a Skia allocation/parse/encode fails — under memory pressure, say —
// and a throw here would take down the whole screen via the error boundary. Fall
// back to no image so the picker still renders instead of crashing.
function safeMarkerUri(shapeId: TierPts, iconHex: string, glowHex: string | null, size: number): string | undefined {
  try {
    return dataUri(renderMarkerBase64(shapeId, iconHex, glowHex, size));
  } catch {
    return undefined;
  }
}

export default function MarkerCustomizationScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const shapeForTier    = useMarkerCustomizationStore((s) => s.shapeForTier);
  const setShapeForTier = useMarkerCustomizationStore((s) => s.setShapeForTier);
  const colors          = useMarkerCustomizationStore((s) => s.colors);
  const setColor        = useMarkerCustomizationStore((s) => s.setColor);
  const opacity         = useMarkerCustomizationStore((s) => s.opacity);
  const setOpacity      = useMarkerCustomizationStore((s) => s.setOpacity);
  const isGenerating    = useMarkerCustomizationStore((s) => s.isGenerating);
  const isDirty         = useMarkerCustomizationStore((s) => s.isDirty);
  const regenerate      = useMarkerCustomizationStore((s) => s.regenerate);
  const reset           = useMarkerCustomizationStore((s) => s.reset);

  const [colorPicker, setColorPicker] = useState<{ state: CustomizableState; kind: 'icon' | 'glow' } | null>(null);
  const [previewTier, setPreviewTier] = useState<TierPts>(30);
  const [previewState, setPreviewState] = useState<CustomizableState>('flashUncaptured');

  // One neutral-grey thumbnail per silhouette — reused across all 6 tier rows,
  // so the picker reads as "which shape", independent of color.
  const thumbnails = useMemo(() => {
    const map = {} as Record<TierPts, string | undefined>;
    for (const shapeId of SHAPE_IDS) map[shapeId] = safeMarkerUri(shapeId, '#9a9a9a', null, THUMB_SIZE);
    return map;
  }, []);

  const previewUri = useMemo(() => {
    const shapeId = shapeForTier[previewTier] ?? previewTier;
    const palette = colors[previewState];
    return safeMarkerUri(shapeId, palette.icon, palette.glow, PREVIEW_SIZE);
  }, [shapeForTier, previewTier, colors, previewState]);

  return (
    <SettingsShell title={t('markerCustomization.title')}>
      {/* ── Aperçu ── */}
      <Text style={styles.subcategoryLabel}>{t('markerCustomization.sectionPreview')}</Text>
      <View style={styles.previewCard}>
        <Image source={{ uri: previewUri }} style={styles.previewImage} />
        <View style={styles.previewTabsRow}>
          {STATE_ORDER.map((state) => {
            const isActive = state === previewState;
            return (
              <Pressable
                key={state}
                onPress={() => { hapticTap(); setPreviewState(state); }}
                style={({ pressed }) => [styles.previewTab, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
              >
                <Text style={[styles.previewTabText, isActive && { color: theme.accent }]}>{t(`markerCustomization.state.${state}`)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.previewTiersRow}>
          {TIER_VALUES.map((tier) => {
            const isActive = tier === previewTier;
            return (
              <Pressable
                key={tier}
                onPress={() => { hapticTap(); setPreviewTier(tier); }}
                style={({ pressed }) => [styles.previewTierBtn, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
              >
                <Text style={[styles.previewTierText, isActive && { color: theme.accent }]}>{tier}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Formes ── */}
      <Text style={[styles.subcategoryLabel, styles.subcategoryLabelSpaced]}>{t('markerCustomization.sectionShapes')}</Text>
      <Text style={styles.sectionSubtitle}>{t('markerCustomization.sectionShapesSubtitle')}</Text>
      {TIER_VALUES.map((tier) => (
        <View key={tier} style={styles.shapeRow}>
          <Text style={styles.shapeRowLabel}>{tier} pts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shapeOptionsRow}>
            {SHAPE_IDS.map((shapeId) => {
              const isActive = shapeForTier[tier] === shapeId;
              return (
                <Pressable
                  key={shapeId}
                  onPress={() => { hapticTap(); setShapeForTier(tier, shapeId); setPreviewTier(tier); }}
                  style={({ pressed }) => [styles.shapeThumb, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
                >
                  <Image source={{ uri: thumbnails[shapeId] }} style={styles.shapeThumbImage} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}

      {/* ── Couleurs ── */}
      <Text style={[styles.subcategoryLabel, styles.subcategoryLabelSpaced]}>{t('markerCustomization.sectionColors')}</Text>
      {STATE_ORDER.map((state) => (
        <View key={state} style={styles.colorStateRow}>
          <Text style={styles.colorStateLabel}>{t(`markerCustomization.state.${state}`)}</Text>
          <View style={styles.colorSwatchesRow}>
            <Pressable
              onPress={() => { hapticTap(); setPreviewState(state); setColorPicker({ state, kind: 'icon' }); }}
              style={({ pressed }) => [styles.colorSwatch, { backgroundColor: colors[state].icon, borderColor: theme.border }, pressed && styles.pressed]}
            />
            <Pressable
              onPress={() => { hapticTap(); setPreviewState(state); setColorPicker({ state, kind: 'glow' }); }}
              style={({ pressed }) => [styles.colorSwatch, styles.glowSwatch, { backgroundColor: colors[state].glow, borderColor: theme.border }, pressed && styles.pressed]}
            />
          </View>
        </View>
      ))}

      {/* ── Opacité ── */}
      <Text style={[styles.subcategoryLabel, styles.subcategoryLabelSpaced]}>{t('markerCustomization.sectionOpacity')}</Text>
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabel}>
          <Text style={styles.toggleText}>{t('markerCustomization.opacity')}</Text>
          <Text style={styles.toggleSubtitle}>{t('markerCustomization.opacitySubtitle')}</Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            style={({ pressed }) => [styles.stepperBtn, opacity <= 0 && styles.stepperBtnDisabled, pressed && styles.pressed]}
            disabled={opacity <= 0}
            onPress={() => { hapticTap(); setOpacity(opacity - OPACITY_STEP); }}
          >
            <Text style={styles.stepperBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{Math.round(opacity * 100)}%</Text>
          <Pressable
            style={({ pressed }) => [styles.stepperBtn, opacity >= 1 && styles.stepperBtnDisabled, pressed && styles.pressed]}
            disabled={opacity >= 1}
            onPress={() => { hapticTap(); setOpacity(opacity + OPACITY_STEP); }}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Actions ── */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, (pressed || isGenerating) && styles.pressed]}
          disabled={isGenerating}
          onPress={() => { hapticTap(); reset().catch(() => {}); }}
        >
          <Text style={styles.secondaryBtnText}>{t('markerCustomization.reset')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: theme.accent },
            (pressed || isGenerating || !isDirty) && styles.pressed,
          ]}
          disabled={isGenerating || !isDirty}
          onPress={() => { hapticTap(); regenerate().catch(() => {}); }}
        >
          {isGenerating ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.primaryBtnText}>{t('markerCustomization.validate')}</Text>}
        </Pressable>
      </View>

      {colorPicker && (
        <ColorPickerModal
          visible
          title={t(`markerCustomization.${colorPicker.kind}Color`)}
          currentColor={colors[colorPicker.state][colorPicker.kind]}
          onClose={() => setColorPicker(null)}
          onValidate={(hex) => setColor(colorPicker.state, colorPicker.kind, hex)}
        />
      )}
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
    subcategoryLabel: {
      color: t.accent,
      fontFamily: ButtonFont,
      fontSize: FontSize.md,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    subcategoryLabelSpaced: { marginTop: Spacing.two },
    sectionSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20 },

    previewCard: {
      alignItems: 'center', gap: Spacing.three,
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border,
      borderRadius: BorderRadius.md, padding: Spacing.four,
    },
    previewImage: { width: PREVIEW_SIZE, height: PREVIEW_SIZE },
    previewTabsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.one },
    previewTab: {
      paddingVertical: 6, paddingHorizontal: Spacing.two,
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    previewTabText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    previewTiersRow: { flexDirection: 'row', gap: Spacing.one },
    previewTierBtn: {
      width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    previewTierText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },

    shapeRow: { gap: Spacing.one },
    shapeRowLabel: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },
    shapeOptionsRow: { flexDirection: 'row', gap: Spacing.two },
    shapeThumb: {
      width: THUMB_SIZE + 16, height: THUMB_SIZE + 16, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgElement,
    },
    shapeThumbImage: { width: THUMB_SIZE, height: THUMB_SIZE },

    colorStateRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border,
      borderRadius: BorderRadius.md, padding: Spacing.three,
    },
    colorStateLabel: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    colorSwatchesRow: { flexDirection: 'row', gap: Spacing.two },
    colorSwatch: { width: 36, height: 36, borderRadius: BorderRadius.sm, borderWidth: 2 },
    glowSwatch: { opacity: 0.85 },

    toggleRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.three,
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border,
      borderRadius: BorderRadius.md, padding: Spacing.three,
    },
    toggleLabel: { flex: 1, gap: 4 },
    toggleText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    toggleSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20 },

    stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnDisabled: { opacity: 0.35 },
    stepperBtnText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.xl, lineHeight: 24 },
    stepperValue: { minWidth: 44, textAlign: 'center', color: t.text, fontFamily: ButtonFont, fontSize: FontSize.lg },

    actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
    secondaryBtn: {
      flex: 1, paddingVertical: 14, alignItems: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border,
    },
    secondaryBtnText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md },
    primaryBtn: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: BorderRadius.sm },
    primaryBtnText: { color: t.bg, fontFamily: ButtonFont, fontSize: FontSize.md },
  });
}
