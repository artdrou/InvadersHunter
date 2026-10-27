/**
 * Player recap at the top of the Settings tab (arcade "PLAYER 1" card):
 * sprite + name, then score / flashes / cities. Tap → profile (or sign-up for guests).
 *
 * Not exported from the settings barrel: it reads the invaders feature, whose
 * components import the settings barrel (haptics) — keeps the require cycle out.
 */
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useAuthStore } from '@/features/auth';
import { useInvaderStore } from '@/features/invaders/store';
import { computeCollectionStats } from '@/features/invaders/utils/collection-stats';
import { BorderRadius, Spacing } from '@/constants/theme';
import { arcadeShadow } from '@/constants/arcade-button';

const SPRITE = require('../../../../assets/images/marker-20pts-flash-captured.png');

export function PlayerCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  // Store only: the tabs already sync, a second useInvaderData would re-run it
  const invaders = useInvaderStore((s) => s.invaders);
  const progress = useInvaderStore((s) => s.progress);
  const stats = useMemo(
    () => computeCollectionStats(invaders, new Set(progress.map((p) => p.invader_id))),
    [invaders, progress],
  );

  const stat = (label: string, value: number) => (
    <View style={styles.stat}>
      <Text style={{ color: theme.textMuted, fontFamily: appFont, fontSize: sz(11) }}>{label}</Text>
      <Text style={{ color: theme.accent, fontFamily: appFont, fontSize: sz(20) }}>{value}</Text>
    </View>
  );

  return (
    <Pressable
      onPress={() => router.push(isGuest ? '/register' : '/settings/profile-info')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.bgElement,
          borderColor: theme.accent,
          boxShadow: arcadeShadow(theme, 4),
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.who}>
        <Image source={SPRITE} style={styles.sprite} contentFit="contain" />
        <View style={styles.whoText}>
          <Text style={{ color: theme.text, fontFamily: appFont, fontSize: sz(18) }} numberOfLines={1}>
            {isGuest ? t('settings.playerGuest') : user?.username ?? ''}
          </Text>
          <Text style={{ color: theme.textMuted, fontFamily: appFont, fontSize: sz(12) }} numberOfLines={1}>
            {isGuest ? t('settings.playerCreateAccount') : t('settings.playerSeeProfile')} ›
          </Text>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.bgDivider }]} />
      <View style={styles.stats}>
        {stat(t('settings.playerScore'), stats.score)}
        {stat(t('settings.playerFlashes'), stats.flashed)}
        {stat(t('settings.playerCities'), stats.citiesWithFlashes)}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: BorderRadius.sm,
    padding: Spacing.three,
    gap: Spacing.two,
    // room for the offset shadow
    marginRight: 4,
    marginBottom: 4,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sprite: { width: 40, height: 40 },
  whoText: { flex: 1, gap: 2 },
  divider: { height: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
});
