/**
 * Flash Import — tutorial screen.
 *
 * Self-contained route for the "Import flashes" feature. Points to the browser
 * importer (hintvaders.app/flash-importer, with Copy / Send for the link), then
 * the Windows tool and a manual paste fallback that posts to /flash-import/.
 *
 * Feature code lives in @/features/flash-import. Keep all UI/logic for this
 * feature local — do not mix into other screens.
 */
import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Alert, Linking, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { StreetsBackground } from '@/components/StreetsBackground';
import { ArcadeTitle } from '@/components/ArcadeTitle';
import { type ThemeTokens, FontSize, BorderRadius, Spacing, AppFont } from '@/constants/theme';
import {
  importFlashes, SCRIPT_DOWNLOAD_URL, WEB_IMPORTER_URL, displayUrl, type FlashImportResponse,
} from '@/features/flash-import';
import { apiErrorDetail } from '@/services/api-client';
import { copyToClipboard } from '@/services/clipboard';
import { tap as hapticTap, success as hapticSuccess } from '@/features/settings/haptics';
import { useInvaderStore } from '@/features/invaders';
import { arcadeButton, arcadeButtonLabel, arcadeCard } from '@/constants/arcade-button';
import { ShadowText } from '@/components/ShadowText';

const COPIED_MS = 1500;

export default function FlashImportScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();

  const STEPS = [
    { n: 1, title: t('flashImport.step1Title'), body: t('flashImport.step1Body') },
    { n: 2, title: t('flashImport.step2Title'), body: t('flashImport.step2Body') },
    { n: 3, title: t('flashImport.step3Title'), body: t('flashImport.step3Body') },
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
  const [copied, setCopied]       = useState(false);

  async function handleCopy() {
    if (!(await copyToClipboard(WEB_IMPORTER_URL))) {
      handleShare();  // no clipboard in this build: the share sheet still gets the link out
      return;
    }
    hapticSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  }

  function handleShare() {
    hapticTap();
    Share.share({ message: t('flashImport.shareMessage', { link: WEB_IMPORTER_URL }) });
  }

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
    } catch (e) {
      Alert.alert(t('common.error'), apiErrorDetail(e) ?? t('flashImport.importImpossible'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <StreetsBackground intensity="faint" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.backText}>{'<- ' + t('common.back')}</Text>
        </Pressable>
        <ArcadeTitle text={t('flashImport.title')} />
      </View>

      <Text style={styles.intro}>{t('flashImport.intro')}</Text>

      <View style={styles.addressCard}>
        <Text style={styles.addressLabel}>{t('flashImport.addressLabel')}</Text>
        <Text style={styles.address} selectable>{displayUrl(WEB_IMPORTER_URL)}</Text>
        <View style={styles.addressActions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, styles.addressBtn, pressed && styles.pressed]}
            onPress={handleCopy}>
            <Text style={styles.primaryBtnText}>{copied ? t('flashImport.copied') : t('flashImport.copyBtn')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, styles.addressBtn, pressed && styles.pressed]}
            onPress={handleShare}>
            <ShadowText shadowColor={theme.titleShadow} style={styles.secondaryBtnText}>{t('flashImport.shareBtn')}</ShadowText>
          </Pressable>
        </View>
      </View>

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

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t('flashImport.windowsTitle')}</Text>
      <Text style={styles.note}>{t('flashImport.windowsNote')}</Text>
      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        onPress={handleDownload}>
        <ShadowText shadowColor={theme.titleShadow} style={styles.secondaryBtnText}>{t('flashImport.downloadBtn')}</ShadowText>
      </Pressable>

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
          : <ShadowText shadowColor={theme.titleShadow} style={styles.secondaryBtnText}>{t('flashImport.importBtn')}</ShadowText>}
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
    </View>
  );
}

function makeStyles(t: ThemeTokens, _appFont: string, scale: number, top: number, bottom: number) {
  const sz = (n: number) => Math.round(n * scale);
  // Use the platform's default system font for readability on this tutorial
  // (the pixel fonts bundled elsewhere lack accented characters or are hard to read in long copy).
  const font = undefined as unknown as string;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },
    content: {
      paddingTop: top + Spacing.three,
      paddingBottom: bottom + Spacing.five,
      paddingHorizontal: Spacing.four,
      gap: Spacing.three,
    },
    header: { gap: Spacing.two },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    backText: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm) },
    intro: { color: t.text, fontFamily: font, fontSize: sz(FontSize.sm), lineHeight: 18 },
    step: {
      flexDirection: 'row',
      gap: Spacing.three,
      ...arcadeCard(t),
      padding: Spacing.three,
    },
    addressCard: {
      ...arcadeCard(t),
      borderColor: t.accent,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    addressLabel: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.sm) },
    address: { color: t.accent, fontFamily: font, fontSize: sz(FontSize.lg), fontWeight: '600' },
    addressActions: { flexDirection: 'row', gap: Spacing.two },
    addressBtn: { flex: 1 },
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
      ...arcadeButton(t),
      borderRadius: BorderRadius.sm,
      paddingVertical: 14, alignItems: 'center',
    },
    primaryBtnText: { ...arcadeButtonLabel(t), fontSize: FontSize.md },
    secondaryBtn: {
      ...arcadeButton(t, 'outline'),
      borderRadius: BorderRadius.sm,
      paddingVertical: 12, alignItems: 'center',
    },
    secondaryBtnText: { ...arcadeButtonLabel(t, 'outline'), fontSize: FontSize.md },
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
      ...arcadeCard(t), borderColor: t.success ?? t.accent,
      padding: Spacing.three, gap: 4,
    },
    resultLine: { color: t.text, fontFamily: font, fontSize: sz(FontSize.sm) },
    resultStrong: { color: t.accent, fontFamily: AppFont },
    resultDone: { color: t.textMuted, fontFamily: font, fontSize: sz(FontSize.xs), marginTop: Spacing.two },
  });
}
