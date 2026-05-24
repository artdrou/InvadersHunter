/**
 * Flash Import — tutorial screen.
 *
 * Self-contained route for the "Import flashes" feature. Explains the PC-side
 * workflow (USB debugging + adb + Python script) and offers a manual paste
 * fallback that posts directly to /flash-import/.
 *
 * Feature code lives in @/features/flash-import. Keep all UI/logic for this
 * feature local — do not mix into other screens.
 */
import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, AppFont } from '@/constants/theme';
import { importFlashes, SCRIPT_DOWNLOAD_URL, type FlashImportResponse } from '@/features/flash-import';
import { useInvaderStore } from '@/features/invaders';

export default function FlashImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();

  const STEPS = [
    { n: 1, title: t('flashImport.step1Title'), body: t('flashImport.step1Body') },
    { n: 2, title: t('flashImport.step2Title'), body: t('flashImport.step2Body') },
    { n: 3, title: t('flashImport.step3Title'), body: t('flashImport.step3Body') },
    { n: 4, title: t('flashImport.step4Title'), body: t('flashImport.step4Body') },
    { n: 5, title: t('flashImport.step5Title'), body: t('flashImport.step5Body') },
  ];
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(theme, appFont, fontScale, insets.top, insets.bottom),
    [theme, appFont, fontScale, insets.top, insets.bottom],
  );

  const requestSync = useInvaderStore((s) => s.requestSync);

  const [pasted, setPasted]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState<FlashImportResponse | null>(null);

  async function handleDownload() {
    const ok = await Linking.canOpenURL(SCRIPT_DOWNLOAD_URL);
    if (!ok) {
      Alert.alert(t('flashImport.linkUnavailableTitle'), t('flashImport.linkUnavailableBody'));
      return;
    }
    Linking.openURL(SCRIPT_DOWNLOAD_URL);
  }

  async function handlePasteImport() {
    const names = pasted
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      Alert.alert(t('flashImport.noNamesTitle'), t('flashImport.noNamesBody'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await importFlashes(names);
      setResult(res);
      requestSync();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.detail ?? e?.message ?? t('flashImport.importImpossible'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backText}>{'<- ' + t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('flashImport.title')}</Text>
      </View>

      <Text style={styles.intro}>{t('flashImport.intro')}</Text>

      {STEPS.map((s) => (
        <View key={s.n} style={styles.step}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{s.n}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepText}>{s.body}</Text>
          </View>
        </View>
      ))}

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        onPress={handleDownload}>
        <Text style={styles.primaryBtnText}>{t('flashImport.downloadBtn')}</Text>
      </Pressable>

      <Text style={styles.note}>{t('flashImport.downloadNote')}</Text>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t('flashImport.alternativeTitle')}</Text>
      <Text style={styles.note}>{t('flashImport.alternativeNote')}</Text>
      <TextInput
        value={pasted}
        onChangeText={setPasted}
        multiline
        placeholder={'PA_1234\nLYO_56\nNY_789'}
        placeholderTextColor={theme.textMuted}
        style={styles.textArea}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, (pressed || submitting) && styles.pressed]}
        onPress={handlePasteImport}
        disabled={submitting}>
        {submitting
          ? <ActivityIndicator color={theme.accent} />
          : <Text style={styles.secondaryBtnText}>{t('flashImport.importBtn')}</Text>}
      </Pressable>

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLine}>{t('flashImport.imported')} : <Text style={styles.resultStrong}>{result.imported}</Text></Text>
          <Text style={styles.resultLine}>{t('flashImport.alreadyFlashed')} : <Text style={styles.resultStrong}>{result.already_flashed}</Text></Text>
          <Text style={styles.resultLine}>{t('flashImport.unknown')} : <Text style={styles.resultStrong}>{result.unknown.length}</Text></Text>
          <Text style={styles.resultDone}>{t('flashImport.done')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, _appFont: string, scale: number, top: number, bottom: number) {
  const sz = (n: number) => Math.round(n * scale);
  // Use the platform's default system font for readability on this tutorial
  // (the pixel fonts bundled elsewhere lack accented characters or are hard to read in long copy).
  const font = undefined as unknown as string;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: {
      paddingTop: top + Spacing.three,
      paddingBottom: bottom + Spacing.five,
      paddingHorizontal: Spacing.four,
      gap: Spacing.three,
    },
    header: { gap: Spacing.two },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    backText: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm) },
    title: { color: t.accent, fontFamily: font, fontSize: sz(FontSize.xl), letterSpacing: 1 },
    intro: { color: t.text, fontFamily: font, fontSize: sz(FontSize.sm), lineHeight: 18 },
    step: {
      flexDirection: 'row',
      gap: Spacing.three,
      backgroundColor: t.bgElement,
      borderColor: t.border,
      borderWidth: 1,
      borderRadius: BorderRadius.sm,
      padding: Spacing.three,
    },
    stepBadge: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    stepBadgeText: { color: t.bg, fontFamily: AppFont, fontSize: FontSize.sm },
    stepBody: { flex: 1, gap: 4 },
    stepTitle: { color: t.text, fontFamily: font, fontSize: sz(FontSize.md) },
    stepText:  { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm), lineHeight: 17 },
    primaryBtn: {
      borderWidth: 1, borderColor: t.accent, backgroundColor: t.bgElement,
      borderRadius: BorderRadius.sm,
      paddingVertical: 14, alignItems: 'center',
    },
    primaryBtnText: { color: t.accent, fontFamily: AppFont, fontSize: FontSize.md },
    secondaryBtn: {
      borderWidth: 1, borderColor: t.border, backgroundColor: t.bgElement,
      borderRadius: BorderRadius.sm,
      paddingVertical: 12, alignItems: 'center',
    },
    secondaryBtnText: { color: t.accent, fontFamily: AppFont, fontSize: FontSize.md },
    note: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs), lineHeight: 15 },
    divider: { height: 1, backgroundColor: t.bgDivider, marginVertical: Spacing.two },
    sectionTitle: {
      color: t.text, fontFamily: font, fontSize: sz(FontSize.md),
      letterSpacing: 1, textTransform: 'uppercase',
    },
    textArea: {
      minHeight: 120,
      borderWidth: 1, borderColor: t.border, borderRadius: BorderRadius.sm,
      backgroundColor: t.bgElement,
      color: t.text, fontFamily: font, fontSize: sz(FontSize.sm),
      padding: Spacing.three,
      textAlignVertical: 'top',
    },
    pressed: { opacity: 0.7 },
    resultBox: {
      borderWidth: 1, borderColor: t.success ?? t.accent,
      borderRadius: BorderRadius.sm, padding: Spacing.three, gap: 4,
    },
    resultLine: { color: t.text, fontFamily: font, fontSize: sz(FontSize.sm) },
    resultStrong: { color: t.accent, fontFamily: AppFont },
    resultDone: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs), marginTop: Spacing.two },
  });
}
