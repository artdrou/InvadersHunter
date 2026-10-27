/**
 * Appearance → Theme: the theme cards (each one a live preview of its colours and title
 * style), a preview strip (button + route line) and, for the custom theme, its editor.
 * Built-in themes have fixed colours; choosing colours is what "Perso" is for.
 */
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  themes, buildCustomTheme, CUSTOM_PRESETS, DEFAULT_CUSTOM_THEME,
  type ThemeName, type ThemeTokens, type CustomThemeSettings,
  ButtonFont, BorderRadius, Spacing, FontSize,
} from '@/constants/theme';
import { ArcadeTitle } from '@/components/ArcadeTitle';
import { tap } from '../haptics';
import { ColorPickerModal } from './ColorPickerModal';
import { arcadeButton, arcadeButtonLabel } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';

const PREVIEW_TEXT = 'ABC';

export function ThemePicker() {
  const { t } = useTranslation();
  const { theme, themeName, setTheme, custom } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const order: ThemeName[] = [...(Object.keys(themes) as ThemeName[]), 'custom'];

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.grid}>
          {order.map((name) => {
            const tk = name === 'custom' ? buildCustomTheme(custom) : themes[name];
            const active = name === themeName;
            return (
              <Pressable
                key={name}
                style={({ pressed }) => [styles.themeCard, active && { borderColor: theme.accent }, pressed && styles.pressed]}
                onPress={() => { tap(); setTheme(name); }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.mini, { backgroundColor: tk.bg, borderColor: tk.border }]}>
                  <ArcadeTitle text={PREVIEW_TEXT} size={12} colors={tk} />
                  <View style={styles.dots}>
                    <View style={[styles.dot, { backgroundColor: tk.accent }]} />
                    <View style={[styles.dot, { backgroundColor: tk.routePath }]} />
                    <View style={[styles.dot, { backgroundColor: tk.bgElement, borderColor: tk.border, borderWidth: 1 }]} />
                  </View>
                </View>
                <Text style={[styles.themeName, active && { color: theme.accent }]} numberOfLines={1}>
                  {name === 'custom' ? `${t('themeNames.custom')} ✎` : t(`themeNames.${name}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.previewRow}>
          <View style={styles.previewBtn}><Text style={styles.previewBtnText}>{t('appearance.previewButton')}</Text></View>
          <View style={[styles.previewBtn, styles.previewBtnOutline]}>
            <ShadowText shadowColor={theme.titleShadow} style={styles.previewBtnOutlineText}>{t('appearance.previewOutline')}</ShadowText>
          </View>
          <View style={[styles.previewRoute, { backgroundColor: theme.routePath, shadowColor: theme.routePath }]} />
        </View>
      </View>

      {themeName === 'custom'
        ? <CustomThemeEditor />
        : <Text style={styles.note}>{t('appearance.classicThemeNote')}</Text>}
    </View>
  );
}

type ColorKey = keyof typeof CUSTOM_PRESETS;

function CustomThemeEditor() {
  const { t } = useTranslation();
  const { custom, setCustom } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [picking, setPicking] = useState<ColorKey | null>(null);

  const colorRow = (key: ColorKey, label: string, subtitle?: string) => (
    <View style={styles.row} key={key}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowText}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.swatches}>
        {CUSTOM_PRESETS[key].map((c) => (
          <Pressable
            key={c}
            onPress={() => { tap(); setCustom({ [key]: c }); }}
            style={[styles.swatch, { backgroundColor: c }, custom[key].toLowerCase() === c.toLowerCase() && styles.swatchOn]}
            accessibilityLabel={c}
          />
        ))}
        <Pressable onPress={() => { tap(); setPicking(key); }} style={styles.swatchMore} accessibilityLabel={t('appearance.otherColor')}>
          <Text style={styles.swatchMoreText}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  const segment = <K extends 'base' | 'titleStyle'>(key: K, options: [CustomThemeSettings[K], string][]) => (
    <View style={styles.segment}>
      {options.map(([value, label]) => {
        const on = custom[key] === value;
        return (
          <Pressable key={value} onPress={() => { tap(); setCustom({ [key]: value } as Partial<CustomThemeSettings>); }}
            style={[styles.segBtn, on && styles.segBtnOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <>
      <Text style={styles.sectionLabel}>{t('appearance.customTheme')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowText}>{t('appearance.base')}</Text>
            <Text style={styles.rowSubtitle}>{t('appearance.baseSubtitle')}</Text>
          </View>
          {segment('base', [['dark', t('themeNames.dark')], ['light', t('themeNames.light')]])}
        </View>
        {colorRow('accent', t('profile.accentColor'), t('appearance.accentSubtitle'))}
        {colorRow('routePath', t('profile.routeColor'), t('appearance.routeSubtitle'))}
      </View>

      <Text style={styles.sectionLabel}>{t('appearance.titles')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={styles.rowText}>{t('appearance.titleStyle')}</Text>
            <Text style={styles.rowSubtitle}>{t('appearance.titleStyleSubtitle')}</Text>
          </View>
          {segment('titleStyle', [['initial', t('appearance.titleInitial')], ['arcade', t('appearance.titleArcade')]])}
        </View>
        {colorRow('titleStroke', t('appearance.titleStroke'))}
        {colorRow('titleInner', t('appearance.titleInner'))}
        {colorRow('titleShadow', t('appearance.titleShadow'))}
      </View>

      <ColorPickerModal
        visible={picking !== null}
        title={picking ? t(`appearance.pick.${picking}`) : ''}
        currentColor={picking ? custom[picking] : '#000000'}
        onClose={() => setPicking(null)}
        onValidate={(c) => picking && setCustom({ [picking]: c })}
        onReset={() => picking && setCustom({ [picking]: DEFAULT_CUSTOM_THEME[picking] })}
      />
    </>
  );
}

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    wrap: { gap: Spacing.two },
    card: {
      backgroundColor: t.bgElement, borderWidth: 1, borderColor: t.border,
      borderRadius: BorderRadius.md, padding: Spacing.three, gap: Spacing.three,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    themeCard: {
      width: '31%', flexGrow: 1, borderWidth: 2, borderColor: t.border,
      borderRadius: BorderRadius.sm, padding: 6, alignItems: 'center', gap: 6,
    },
    mini: {
      alignSelf: 'stretch', borderRadius: 6, borderWidth: 1,
      paddingHorizontal: 6, paddingTop: 6, paddingBottom: 6, gap: 8,
    },
    dots: { flexDirection: 'row', gap: 4 },
    dot: { width: 14, height: 6, borderRadius: 2 },
    themeName: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.xs },
    pressed: { opacity: 0.6 },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    previewBtn: {
      flex: 1, ...arcadeButton(t), borderRadius: BorderRadius.sm,
      paddingVertical: 10, alignItems: 'center',
    },
    previewBtnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
    previewBtnOutline: arcadeButton(t, 'outline'),
    previewBtnOutlineText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
    previewRoute: {
      flex: 1, height: 6, borderRadius: 3,
      shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3,
    },
    note: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs, lineHeight: 18, paddingHorizontal: Spacing.one },
    sectionLabel: {
      color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs,
      letterSpacing: 1, textTransform: 'uppercase', marginTop: Spacing.three, paddingHorizontal: Spacing.two,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    rowLabel: { flex: 1, gap: 2 },
    rowText: { color: t.text, fontFamily: ButtonFont, fontSize: FontSize.md },
    rowSubtitle: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.xs },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: 190 },
    swatch: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.border },
    swatchOn: { borderColor: t.text },
    swatchMore: {
      width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed',
      borderColor: t.textMuted, alignItems: 'center', justifyContent: 'center',
    },
    swatchMoreText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.md, lineHeight: 18 },
    segment: { flexDirection: 'row', borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm, overflow: 'hidden' },
    segBtn: { paddingVertical: 7, paddingHorizontal: 10 },
    segBtnOn: { backgroundColor: t.accent },
    segText: { color: t.textMuted, fontFamily: ButtonFont, fontSize: FontSize.sm },
    segTextOn: { color: t.bg },
  });
}
