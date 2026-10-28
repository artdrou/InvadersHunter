/**
 * Player recap at the top of the Settings tab (arcade "PLAYER 1" card):
 * profile icon + name, then score / flashes / cities. Tap → profile (or sign-up for guests).
 * PlayerCardView is the same card for any player (the Social tab shows one per friend).
 *
 * Not exported from the settings barrel: it reads the invaders feature, whose
 * components import the settings barrel (haptics) — keeps the require cycle out.
 */
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { useAuthStore } from '@/features/auth';
import { useInvaderStore } from '@/features/invaders/store';
import { computeCollectionStats, type CollectionStats } from '@/features/invaders/utils/collection-stats';
import { BorderRadius, Spacing } from '@/constants/theme';
import { arcadeShadow } from '@/constants/arcade-button';
import { PlayerAvatar, useMyAvatar, type Avatar } from '@/features/avatar';

export function PlayerCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const avatar = useMyAvatar();
  // Store only: the tabs already sync, a second useInvaderData would re-run it
  const invaders = useInvaderStore((s) => s.invaders);
  const progress = useInvaderStore((s) => s.progress);
  const stats = useMemo(
    () => computeCollectionStats(invaders, new Set(progress.map((p) => p.invader_id))),
    [invaders, progress],
  );

  return (
    <PlayerCardView
      avatar={avatar}
      name={isGuest ? t('settings.playerGuest') : user?.username ?? ''}
      subtitle={isGuest ? t('settings.playerCreateAccount') : t('settings.playerSeeProfile')}
      stats={stats}
      onPress={() => router.push(isGuest ? '/register' : '/settings/profile-info')}
    />
  );
}

type ViewProps = {
  avatar: Avatar | null | undefined;
  name: string;
  subtitle: string;
  stats: Pick<CollectionStats, 'score' | 'flashed' | 'citiesWithFlashes'>;
  onPress: () => void;
};

export function PlayerCardView({ avatar, name, subtitle, stats, onPress }: ViewProps) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  const stat = (label: string, value: number) => (
    <View style={styles.stat}>
      <Text style={{ color: theme.textMuted, fontFamily: appFont, fontSize: sz(11) }}>{label}</Text>
      <Text style={{ color: theme.accent, fontFamily: appFont, fontSize: sz(20) }}>{value}</Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
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
        <PlayerAvatar avatar={avatar} size={40} />
        <View style={styles.whoText}>
          <Text style={{ color: theme.text, fontFamily: appFont, fontSize: sz(18) }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: theme.textMuted, fontFamily: appFont, fontSize: sz(12) }} numberOfLines={1}>
            {subtitle} ›
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
  whoText: { flex: 1, gap: 2 },
  divider: { height: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
});
