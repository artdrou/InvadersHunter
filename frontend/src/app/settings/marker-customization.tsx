import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { type ThemeTokens, ButtonFont, ButtonFontBold, BorderRadius, Spacing, FontSize } from '@/constants/theme';
import { SettingsShell, hapticTap, ColorPickerModal, ArcadeSegmented, useMarkerCustomizationStore } from '@/features/settings';
import { ALL_SHAPE_IDS } from '@/features/marker-customization/shapes';
import { renderMarkerBase64, decodeBloom, BLOOM_LEVEL_COUNT } from '@/features/marker-customization/generate-markers';
import { TIER_VALUES, STATE_GROUPS, type TierPts, type ShapeId, type CustomizableState, type StateGroup } from '@/features/marker-customization/types';
import { arcadeButton, arcadeButtonLabel, arcadeCard, arcadeLabelColor } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';
import { ArcadeSectionLabel } from '@/components/ArcadeSectionLabel';
import { ShapePicker } from '@/features/settings/components/ShapePicker';

// Thumbnails are rasterized larger (THUMB_RENDER) then scaled down so they stay crisp.
const THUMB_RENDER = 128;
// Tier tabs (current shape of each tier) and the big preview of the selected tier
const TIER_THUMB = 30;
const TIER_PREVIEW = 112;
const STATE_PREVIEW = 76;
const OPACITY_STEP = 0.05;
// Default silhouette used for the color previews (index of the 30pt shape).
const DEFAULT_PREVIEW_SHAPE_IDX = Math.max(0, ALL_SHAPE_IDS.indexOf(30 as TierPts));
// Compact bloom read-out: size letter + intensity level (1..3).
const BLOOM_SIZE_LABELS = ['S', 'M', 'L'];

const STATE_ORDER: CustomizableState[] = ['flashCaptured', 'flashUncaptured', 'highlight', 'grey'];
// Color slots: the 4 states, then the per-tier palette of the "rarity" color mode
type ColorSlot = CustomizableState | 'rarity';
const COLOR_SLOTS: ColorSlot[] = [...STATE_ORDER, 'rarity'];

function dataUri(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

// Rasterizing happens synchronously during render (useMemo). renderMarkerBase64
// throws if a Skia allocation/parse/encode fails — under memory pressure, say —
// and a throw here would take down the whole screen via the error boundary. Fall
// back to no image so the picker still renders instead of crashing.
function safeMarkerUri(shapeId: ShapeId, iconHex: string, glowHex: string | null, size: number, bloomIndex?: number): string | undefined {
  try {
    return dataUri(renderMarkerBase64(shapeId, iconHex, glowHex, size, bloomIndex));
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
  const shapeForState    = useMarkerCustomizationStore((s) => s.shapeForState);
  const setShapeForState = useMarkerCustomizationStore((s) => s.setShapeForState);
  const colors          = useMarkerCustomizationStore((s) => s.colors);
  const setColor        = useMarkerCustomizationStore((s) => s.setColor);
  const rarityColors    = useMarkerCustomizationStore((s) => s.rarityColors);
  const setRarityColor  = useMarkerCustomizationStore((s) => s.setRarityColor);
  const opacity         = useMarkerCustomizationStore((s) => s.opacity);
  const setOpacity      = useMarkerCustomizationStore((s) => s.setOpacity);
  const bloom           = useMarkerCustomizationStore((s) => s.bloom);
  const setBloom        = useMarkerCustomizationStore((s) => s.setBloom);
  const isGenerating    = useMarkerCustomizationStore((s) => s.isGenerating);
  const isDirty         = useMarkerCustomizationStore((s) => s.isDirty);
  const regenerate      = useMarkerCustomizationStore((s) => s.regenerate);
  const reset           = useMarkerCustomizationStore((s) => s.reset);

  // Two tabs over one set of changes: Validate (below both) applies shapes and colors together
  const [tab, setTab] = useState<'shapes' | 'colors'>('shapes');
  const [activeTier, setActiveTier] = useState<TierPts>(TIER_VALUES[0]);
  // Shapes tab edits a tier, or a state group whose shape then replaces the tiers' one
  const [activeGroup, setActiveGroup] = useState<StateGroup | null>(null);
  const [activeState, setActiveState] = useState<ColorSlot>('flashUncaptured');
  const [activeRarityTier, setActiveRarityTier] = useState<TierPts>(TIER_VALUES[0]);
  const [previewShapeIdx, setPreviewShapeIdx] = useState(DEFAULT_PREVIEW_SHAPE_IDX);
  // The picker edits the selected color slot (it can't change while the modal is open)
  const [colorPicker, setColorPicker] = useState<'icon' | 'glow' | null>(null);

  // Shape thumbnails tinted with the "not flashed" colour so the picker reads
  // like the real map markers. One per silhouette of the pool, reused across all 6 tiers.
  const thumbTint = colors.flashUncaptured.icon;
  const thumbnails = useMemo(() => {
    const map = {} as Record<ShapeId, string | undefined>;
    for (const shapeId of ALL_SHAPE_IDS) map[shapeId] = safeMarkerUri(shapeId, thumbTint, null, THUMB_RENDER);
    return map;
  }, [thumbTint]);

  // Big preview of the selected tier's (or state's) shape, as a "not flashed" marker.
  // A state left on its points' shape previews the selected tier, faded.
  const activeTierShape = shapeForTier[activeTier] ?? activeTier;
  const groupShape = activeGroup ? shapeForState[activeGroup] : null;
  const previewShapeId = groupShape ?? activeTierShape;
  const tierPreview = useMemo(() => {
    const p = colors.flashUncaptured;
    return safeMarkerUri(previewShapeId, p.icon, p.glow, THUMB_RENDER, bloom.flashUncaptured);
  }, [previewShapeId, colors.flashUncaptured, bloom.flashUncaptured]);

  // One colored preview per state on the user-selected preview silhouette; the
  // baked bloom (size/intensity) is reflected live here even though it only
  // reaches the map on the next regenerate().
  const previewShape = ALL_SHAPE_IDS[previewShapeIdx];
  const statePreviews = useMemo(() => {
    const map = {} as Record<ColorSlot, string | undefined>;
    for (const state of STATE_ORDER) {
      const p = colors[state];
      map[state] = safeMarkerUri(previewShape, p.icon, p.glow, STATE_PREVIEW, bloom[state]);
    }
    const r = rarityColors[activeRarityTier];
    map.rarity = safeMarkerUri(previewShape, r.icon, r.glow, STATE_PREVIEW);
    return map;
  }, [colors, rarityColors, activeRarityTier, previewShape, bloom]);

  // Rarity has body / glow per tier only: opacity follows flashed / not flashed, bloom is the default
  const activeCustom = activeState === 'rarity' ? null : activeState;
  const activePalette = activeCustom ? colors[activeCustom] : rarityColors[activeRarityTier];
  const activeOpacity = activeCustom ? opacity[activeCustom] : 1;
  const activeBloom = activeCustom ? bloom[activeCustom] : 0;
  const bloomDesc = decodeBloom(activeBloom);

  const applyColor = (kind: 'icon' | 'glow', hex: string) => {
    if (activeCustom) setColor(activeCustom, kind, hex);
    else setRarityColor(activeRarityTier, kind, hex);
  };

  const cyclePreviewShape = (delta: number) => {
    hapticTap();
    setPreviewShapeIdx((i) => (i + delta + ALL_SHAPE_IDS.length) % ALL_SHAPE_IDS.length);
  };

  return (
    <SettingsShell title={t('markerCustomization.title')} centered={false}>
      <ArcadeSegmented
        stretch
        options={[
          { value: 'shapes' as const, label: t('markerCustomization.sectionShapes') },
          { value: 'colors' as const, label: t('markerCustomization.sectionColors') },
        ]}
        value={tab}
        onChange={(v) => { hapticTap(); setTab(v); }}
      />

      {/* ── Formes ── */}
      {/* Both tabs stay mounted (hidden, not unmounted): the shape grid keeps its
          measured size, so switching back doesn't redraw it and jiggle the page */}
      <View style={[styles.tabPane, tab !== 'shapes' && styles.hidden]}>
        <Text style={styles.sectionSubtitle}>{t('markerCustomization.sectionShapesSubtitle')}</Text>
        {/* Which tier is being edited: each tab shows that tier's current shape */}
        <View style={styles.tierRow}>
          {TIER_VALUES.map((tier) => {
            const isActive = !activeGroup && tier === activeTier;
            return (
              <Pressable
                key={tier}
                onPress={() => { hapticTap(); setActiveTier(tier); setActiveGroup(null); }}
                style={({ pressed }) => [styles.tierTab, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
              >
                <Image source={{ uri: thumbnails[shapeForTier[tier] ?? tier] }} style={styles.tierThumb} />
                <Text style={[styles.tierLabel, isActive && { color: theme.accent }]}>{tier}</Text>
              </Pressable>
            );
          })}
        </View>
        {/* States whose shape replaces the points' one (Destroyed → ghost by default) */}
        <Text style={styles.sectionSubtitle}>{t('markerCustomization.sectionStateShapesSubtitle')}</Text>
        <View style={styles.tierRow}>
          {STATE_GROUPS.map((group) => {
            const isActive = group === activeGroup;
            const shape = shapeForState[group];
            return (
              <Pressable
                key={group}
                onPress={() => { hapticTap(); setActiveGroup(group); }}
                style={({ pressed }) => [styles.tierTab, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
              >
                {shape !== null
                  ? <Image source={{ uri: thumbnails[shape] }} style={styles.tierThumb} />
                  : <View style={styles.tierThumb}><Text style={styles.pointsShapeMark}>{t('markerCustomization.pointsShapeShort')}</Text></View>}
                <Text style={[styles.tierLabel, isActive && { color: theme.accent }]} numberOfLines={1}>
                  {t(`markerCustomization.group.${group}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ShapePicker
          selected={activeGroup ? groupShape : activeTierShape}
          onSelect={(shape) => (activeGroup ? setShapeForState(activeGroup, shape) : setShapeForTier(activeTier, shape))}
          thumbnail={(shape) => thumbnails[shape]}
          preview={<Image source={{ uri: tierPreview }} style={[styles.tierPreview, activeGroup && groupShape === null && styles.inheritedPreview]} />}
          between={activeGroup ? (
            <Pressable
              onPress={() => { hapticTap(); setShapeForState(activeGroup, null); }}
              style={({ pressed }) => [styles.pointsShapeBtn, groupShape === null && { borderColor: theme.accent }, pressed && styles.pressed]}
            >
              <Text style={[styles.pointsShapeLabel, groupShape === null && { color: theme.accent }]}>
                {t('markerCustomization.pointsShape')}
              </Text>
            </Pressable>
          ) : undefined}
        />
      </View>

      {/* ── Couleurs ── */}
      <View style={[styles.tabPane, tab !== 'colors' && styles.hidden]}>
        <View style={styles.colorsHeader}>
          <ArcadeSectionLabel title={t('markerCustomization.sectionColors')} style={styles.colorsLabel} />
          {/* Switch which silhouette the state previews are drawn on. */}
          <View style={styles.previewShapeSwitch}>
            <Pressable onPress={() => cyclePreviewShape(-1)} hitSlop={8} style={({ pressed }) => [styles.arrowBtnH, pressed && styles.pressed]}>
              <View style={styles.arrowLeft} />
            </Pressable>
            <Text style={styles.previewShapeVal}>{previewShape}</Text>
            <Pressable onPress={() => cyclePreviewShape(1)} hitSlop={8} style={({ pressed }) => [styles.arrowBtnH, pressed && styles.pressed]}>
              <View style={styles.arrowRight} />
            </Pressable>
          </View>
        </View>

        <View style={styles.stateRow}>
          {COLOR_SLOTS.map((state) => {
            const isActive = state === activeState;
            return (
              <Pressable
                key={state}
                onPress={() => { hapticTap(); setActiveState(state); }}
                style={({ pressed }) => [styles.statePreview, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
              >
                <Image source={{ uri: statePreviews[state] }} style={[styles.statePreviewImg, { opacity: state === 'rarity' ? 1 : opacity[state] }]} />
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
          {/* Rarity: one palette per point value */}
          {!activeCustom && (
            <View style={styles.tierRow}>
              {TIER_VALUES.map((tier) => {
                const isActive = tier === activeRarityTier;
                return (
                  <Pressable
                    key={tier}
                    onPress={() => { hapticTap(); setActiveRarityTier(tier); }}
                    style={({ pressed }) => [styles.tierTab, isActive && { borderColor: theme.accent }, pressed && styles.pressed]}
                  >
                    <View style={[styles.raritySwatch, { backgroundColor: rarityColors[tier].icon, borderColor: rarityColors[tier].glow }]} />
                    <Text style={[styles.tierLabel, isActive && { color: theme.accent }]}>{tier}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={styles.encartParams}>
            {/* Corps (couleur de l'icône) */}
            <Pressable
              onPress={() => { hapticTap(); setColorPicker('icon'); }}
              style={({ pressed }) => [styles.param, pressed && styles.pressed]}
            >
              <View style={[styles.swatch, { backgroundColor: activePalette.icon, borderColor: theme.border }]} />
              <Text style={styles.paramLabel}>{t('markerCustomization.body')}</Text>
            </Pressable>

            {/* Lueur (couleur du halo) */}
            <Pressable
              onPress={() => { hapticTap(); setColorPicker('glow'); }}
              style={({ pressed }) => [styles.param, pressed && styles.pressed]}
            >
              <View style={[styles.swatch, { backgroundColor: activePalette.glow, borderColor: theme.border }]} />
              <Text style={styles.paramLabel}>{t('markerCustomization.gloom')}</Text>
            </Pressable>

            {/* Opacité (appliquée en direct) */}
            {activeCustom && (<>
            <View style={styles.param}>
              <Text style={styles.stepperValue}>{Math.round(activeOpacity * 100)}%</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, activeOpacity <= 0 && styles.arrowDisabled, pressed && styles.pressed]}
                  disabled={activeOpacity <= 0}
                  onPress={() => { hapticTap(); setOpacity(activeCustom, activeOpacity - OPACITY_STEP); }}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, activeOpacity >= 1 && styles.arrowDisabled, pressed && styles.pressed]}
                  disabled={activeOpacity >= 1}
                  onPress={() => { hapticTap(); setOpacity(activeCustom, activeOpacity + OPACITY_STEP); }}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.paramLabel}>{t('markerCustomization.opacityLabel')}</Text>
            </View>

            {/* Bloom (taille × intensité du halo, cuit dans le PNG → regénère) */}
            <View style={styles.param}>
              <Text style={styles.stepperValue}>{BLOOM_SIZE_LABELS[bloomDesc.size]}·{bloomDesc.intensity + 1}</Text>
              <View style={styles.stepper}>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, activeBloom <= 0 && styles.arrowDisabled, pressed && styles.pressed]}
                  disabled={activeBloom <= 0}
                  onPress={() => { hapticTap(); setBloom(activeCustom, activeBloom - 1); }}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.stepperBtn, activeBloom >= BLOOM_LEVEL_COUNT - 1 && styles.arrowDisabled, pressed && styles.pressed]}
                  disabled={activeBloom >= BLOOM_LEVEL_COUNT - 1}
                  onPress={() => { hapticTap(); setBloom(activeCustom, activeBloom + 1); }}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.paramLabel}>{t('markerCustomization.bloom')}</Text>
            </View>
            </>)}
          </View>
        </View>

      </View>

      {/* ── Actions (both tabs) ── */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, (pressed || isGenerating) && styles.pressed]}
          disabled={isGenerating}
          onPress={() => { hapticTap(); reset().catch(() => {}); }}
        >
          <ShadowText shadowColor={theme.titleShadow} style={styles.secondaryBtnText} numberOfLines={1}>{t('markerCustomization.reset')}</ShadowText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            arcadeButton(theme),
            (pressed || isGenerating || !isDirty) && styles.pressed,
          ]}
          disabled={isGenerating || !isDirty}
          onPress={() => { hapticTap(); regenerate().catch(() => {}); }}
        >
          {isGenerating ? <ActivityIndicator color={arcadeLabelColor(theme)} /> : <Text style={styles.primaryBtnText}>{t('markerCustomization.validate')}</Text>}
        </Pressable>
      </View>

      {colorPicker && (
        <ColorPickerModal
          visible
          title={t(`markerCustomization.${colorPicker}Color`)}
          currentColor={activePalette[colorPicker]}
          onClose={() => setColorPicker(null)}
          onValidate={(hex) => applyColor(colorPicker, hex)}
        />
      )}
    </SettingsShell>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    pressed: { opacity: 0.6 },
    tabPane: { gap: Spacing.three },
    hidden: { display: 'none' },
    sectionSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 20 },

    // ── Tier tabs + selected tier preview ──
    tierRow: { flexDirection: 'row', gap: Spacing.two },
    tierTab: {
      flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.one,
      borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: t.border, backgroundColor: t.bgElement,
    },
    tierThumb: { width: TIER_THUMB, height: TIER_THUMB },
    tierLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    tierPreview: { width: TIER_PREVIEW, height: TIER_PREVIEW },
    inheritedPreview: { opacity: 0.35 },
    // State tab left on its points' shape, and the button that sets it back
    pointsShapeMark: { flex: 1, textAlign: 'center', textAlignVertical: 'center', lineHeight: TIER_THUMB, color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xxs },
    pointsShapeBtn: {
      alignSelf: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three,
      borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: t.border, backgroundColor: t.bgElement,
    },
    pointsShapeLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    raritySwatch: { width: 22, height: 22, borderRadius: BorderRadius.sm, borderWidth: 3 },
    arrowDisabled: { opacity: 0.25 },

    // ── Colors header + preview-shape switch ──
    colorsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
    colorsLabel: { flex: 1, marginTop: Spacing.two },
    previewShapeSwitch: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
    arrowBtnH: { paddingHorizontal: 4, paddingVertical: 4 },
    arrowLeft: {
      width: 0, height: 0, backgroundColor: 'transparent',
      borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 8,
      borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: t.text,
    },
    arrowRight: {
      width: 0, height: 0, backgroundColor: 'transparent',
      borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 8,
      borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: t.text,
    },
    previewShapeVal: { minWidth: 72, textAlign: 'center', color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },

    // ── Color state previews ──
    stateRow: { flexDirection: 'row', gap: Spacing.two },
    statePreview: {
      flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.two,
      ...arcadeCard(t),
    },
    statePreviewImg: { width: 44, height: 44 },
    statePreviewLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xxs },

    // ── Params encart (2×2: body / gloom / opacity / bloom) ──
    encart: {
      gap: Spacing.three,
      ...arcadeCard(t), padding: Spacing.three,
    },
    encartTitle: { color: t.text, fontFamily: ButtonFontBold, fontSize: FontSize.md, letterSpacing: 1 },
    encartParams: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.three },
    param: { width: '47%', alignItems: 'center', gap: Spacing.two },
    paramLabel: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, textAlign: 'center' },
    swatch: { width: 44, height: 44, borderRadius: BorderRadius.sm, borderWidth: 2 },

    stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    stepperBtn: {
      width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
      borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: t.border, backgroundColor: t.bg,
    },
    stepperBtnText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.lg, lineHeight: 22 },
    stepperValue: { minWidth: 42, textAlign: 'center', color: t.text, fontFamily: ButtonFont, fontSize: FontSize.sm },

    // ── Actions ──
    actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
    // Sized to its label (never wraps), Validate takes the rest of the row
    secondaryBtn: {
      paddingVertical: 14, paddingHorizontal: Spacing.three, alignItems: 'center',
      borderRadius: BorderRadius.sm, ...arcadeButton(t, 'outline'),
    },
    secondaryBtnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
    primaryBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: BorderRadius.sm },
    primaryBtnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
  });
}
