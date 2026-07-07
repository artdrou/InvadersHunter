import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, ColorPickerModal, useMarkerCustomizationStore } from '@/features/settings';
import { SHAPE_IDS } from '@/features/marker-customization/shapes';
import { renderMarkerBase64 } from '@/features/marker-customization/generate-markers';
import { TIER_VALUES, type TierPts, type CustomizableState } from '@/features/marker-customization/types';

// Carousel geometry. ITEM is the vertical snap height (one shape per page);
// CAROUSEL_W is kept small enough that all 6 tiers fit one row down to a ~320pt
// screen (6 × 44 = 264). Thumbnails are rasterized larger (THUMB_RENDER) then
// scaled down so they stay crisp.
const ITEM = 42;
const CAROUSEL_W = 44;
const THUMB = 34;
const THUMB_RENDER = 72;
const STATE_PREVIEW = 76;
const OPACITY_STEP = 0.05;
// Colors are per-state (not per-tier), so the color previews just need *some*
// representative silhouette — reuse whichever shape the user assigned to 30pts.
const COLOR_PREVIEW_TIER: TierPts = 30;

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

type Styles = ReturnType<typeof makeStyles>;

// One tier's shape picker: a vertical carousel you can flick with a finger or
// step through with the ▲/▼ arrows. Better suited than a long horizontal strip
// once the icon catalog grows past a handful of shapes.
function ShapeCarousel({
  tier, selectedId, thumbnails, styles, accent, onSelect,
}: {
  tier: TierPts;
  selectedId: TierPts;
  thumbnails: Record<TierPts, string | undefined>;
  styles: Styles;
  accent: string;
  onSelect: (tier: TierPts, shapeId: TierPts) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const firstRun = useRef(true);
  const index = Math.max(0, SHAPE_IDS.indexOf(selectedId));
  const lastIndex = SHAPE_IDS.length - 1;

  // Keep the scroll offset aligned with the selection. Instant on mount, then
  // animated so arrow taps glide (a swipe lands here already at the right offset,
  // so its re-scroll is a no-op).
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: index * ITEM, animated: !firstRun.current });
    firstRun.current = false;
  }, [index]);

  const step = (delta: number) => {
    const next = Math.min(lastIndex, Math.max(0, index + delta));
    if (next !== index) { hapticTap(); onSelect(tier, SHAPE_IDS[next]); }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(lastIndex, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (i !== index) onSelect(tier, SHAPE_IDS[i]);
  };

  return (
    <View style={styles.carousel}>
      <Pressable
        disabled={index <= 0}
        onPress={() => step(-1)}
        hitSlop={6}
        style={({ pressed }) => [styles.arrowBtn, index <= 0 && styles.arrowDisabled, pressed && styles.pressed]}
      >
        <View style={styles.arrowUp} />
      </Pressable>

      <View style={styles.carouselViewport}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          disableIntervalMomentum
          decelerationRate="fast"
          nestedScrollEnabled
          contentOffset={{ x: 0, y: index * ITEM }}
          onMomentumScrollEnd={onScrollEnd}
        >
          {SHAPE_IDS.map((sid) => (
            <View key={sid} style={styles.carouselItem}>
              <Image source={{ uri: thumbnails[sid] }} style={styles.carouselThumb} />
            </View>
          ))}
        </ScrollView>
      </View>

      <Pressable
        disabled={index >= lastIndex}
        onPress={() => step(1)}
        hitSlop={6}
        style={({ pressed }) => [styles.arrowBtn, index >= lastIndex && styles.arrowDisabled, pressed && styles.pressed]}
      >
        <View style={styles.arrowDown} />
      </Pressable>

      <Text style={[styles.carouselLabel, { color: accent }]}>{tier}</Text>
    </View>
  );
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

  const [activeState, setActiveState] = useState<CustomizableState>('flashUncaptured');
  const [colorPicker, setColorPicker] = useState<{ state: CustomizableState; kind: 'icon' | 'glow' } | null>(null);

  // Shape thumbnails tinted with the "not flashed" colour so the picker reads
  // like the real map markers. One per silhouette, reused across all 6 tiers.
  const thumbTint = colors.flashUncaptured.icon;
  const thumbnails = useMemo(() => {
    const map = {} as Record<TierPts, string | undefined>;
    for (const shapeId of SHAPE_IDS) map[shapeId] = safeMarkerUri(shapeId, thumbTint, null, THUMB_RENDER);
    return map;
  }, [thumbTint]);

  // One colored preview per state, sharing a representative silhouette.
  const previewShape = shapeForTier[COLOR_PREVIEW_TIER] ?? COLOR_PREVIEW_TIER;
  const statePreviews = useMemo(() => {
    const map = {} as Record<CustomizableState, string | undefined>;
    for (const state of STATE_ORDER) {
      const p = colors[state];
      map[state] = safeMarkerUri(previewShape, p.icon, p.glow, STATE_PREVIEW);
    }
    return map;
  }, [colors, previewShape]);

  const activeOpacity = opacity[activeState];

  return (
    <SettingsShell title={t('markerCustomization.title')}>
      {/* ── Formes ── */}
      <Text style={styles.subcategoryLabel}>{t('markerCustomization.sectionShapes')}</Text>
      <Text style={styles.sectionSubtitle}>{t('markerCustomization.sectionShapesSubtitle')}</Text>
      <View style={styles.carouselRow}>
        {TIER_VALUES.map((tier) => (
          <ShapeCarousel
            key={tier}
            tier={tier}
            selectedId={shapeForTier[tier] ?? tier}
            thumbnails={thumbnails}
            styles={styles}
            accent={theme.accent}
            onSelect={setShapeForTier}
          />
        ))}
      </View>

      {/* ── Couleurs ── */}
      <Text style={[styles.subcategoryLabel, styles.subcategoryLabelSpaced]}>{t('markerCustomization.sectionColors')}</Text>
      <View style={styles.stateRow}>
        {STATE_ORDER.map((state) => {
          const isActive = state === activeState;
          return (
            <Pressable
              key={state}
              onPress={() => { hapticTap(); setActiveState(state); }}
              style={({ pressed }) => [styles.statePreview, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
            >
              <Image source={{ uri: statePreviews[state] }} style={[styles.statePreviewImg, { opacity: opacity[state] }]} />
              <Text style={[styles.statePreviewLabel, isActive && { color: theme.accent }]} numberOfLines={1}>
                {t(`markerCustomization.state.${state}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Encart: paramètres de l'état sélectionné ── */}
      <View style={styles.encart}>
        <Text style={styles.encartTitle}>{t(`markerCustomization.state.${activeState}`)}</Text>
        <View style={styles.encartParams}>
          <Pressable
            onPress={() => { hapticTap(); setColorPicker({ state: activeState, kind: 'icon' }); }}
            style={({ pressed }) => [styles.param, pressed && styles.pressed]}
          >
            <View style={[styles.swatch, { backgroundColor: colors[activeState].icon, borderColor: theme.border }]} />
            <Text style={styles.paramLabel}>{t('markerCustomization.color1')}</Text>
          </Pressable>

          <Pressable
            onPress={() => { hapticTap(); setColorPicker({ state: activeState, kind: 'glow' }); }}
            style={({ pressed }) => [styles.param, pressed && styles.pressed]}
          >
            <View style={[styles.swatch, { backgroundColor: colors[activeState].glow, borderColor: theme.border }]} />
            <Text style={styles.paramLabel}>{t('markerCustomization.color2')}</Text>
          </Pressable>

          <View style={styles.param}>
            <Text style={styles.stepperValue}>{Math.round(activeOpacity * 100)}%</Text>
            <View style={styles.stepper}>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, activeOpacity <= 0 && styles.arrowDisabled, pressed && styles.pressed]}
                disabled={activeOpacity <= 0}
                onPress={() => { hapticTap(); setOpacity(activeState, activeOpacity - OPACITY_STEP); }}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, activeOpacity >= 1 && styles.arrowDisabled, pressed && styles.pressed]}
                disabled={activeOpacity >= 1}
                onPress={() => { hapticTap(); setOpacity(activeState, activeOpacity + OPACITY_STEP); }}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.paramLabel}>{t('markerCustomization.opacityLabel')}</Text>
          </View>
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

    // ── Shapes carousels ──
    carouselRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    carousel: { width: CAROUSEL_W, alignItems: 'center', gap: Spacing.one },
    arrowBtn: { width: CAROUSEL_W, height: 18, alignItems: 'center', justifyContent: 'center' },
    arrowDisabled: { opacity: 0.25 },
    arrowUp: {
      width: 0, height: 0, backgroundColor: 'transparent',
      borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: t.text,
    },
    arrowDown: {
      width: 0, height: 0, backgroundColor: 'transparent',
      borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: t.text,
    },
    carouselViewport: {
      width: CAROUSEL_W, height: ITEM, overflow: 'hidden',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgElement,
    },
    carouselItem: { width: CAROUSEL_W, height: ITEM, alignItems: 'center', justifyContent: 'center' },
    carouselThumb: { width: THUMB, height: THUMB },
    carouselLabel: { fontFamily: ButtonFont, fontSize: FontSize.xs },

    // ── Color state previews ──
    stateRow: { flexDirection: 'row', gap: Spacing.two },
    statePreview: {
      flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.two,
      borderRadius: BorderRadius.md, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgElement,
    },
    statePreviewImg: { width: 44, height: 44 },
    statePreviewLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xxs },

    // ── Params encart ──
    encart: {
      gap: Spacing.three,
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border,
      borderRadius: BorderRadius.md, padding: Spacing.three,
    },
    encartTitle: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md, letterSpacing: 1 },
    encartParams: { flexDirection: 'row', alignItems: 'flex-start' },
    param: { flex: 1, alignItems: 'center', gap: Spacing.two },
    paramLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, textAlign: 'center' },
    swatch: { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },

    stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
    stepperBtn: {
      width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.lg, lineHeight: 22 },
    stepperValue: { minWidth: 42, textAlign: 'center', color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },

    // ── Actions ──
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
