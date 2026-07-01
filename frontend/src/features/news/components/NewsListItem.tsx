import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { getDateLocale } from '@/services/i18n';
import { parseServerDate, type NewsItem } from '../types';

const TYPE_LABEL: Record<NewsItem['type'], string> = {
  invader_added: 'news.typeAdded',
  invader_updated: 'news.typeUpdated',
  announcement: 'news.typeAnnouncement',
  release: 'news.typeRelease',
};

const FALLBACK_ICON: Record<NewsItem['type'], React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  invader_added: 'space-invaders',
  invader_updated: 'space-invaders',
  announcement: 'bullhorn-outline',
  release: 'rocket-launch-outline',
};

type Props = {
  item: NewsItem;
  onOpenInvader: (id: number) => void;
};

export function NewsListItem({ item, onOpenInvader }: Props) {
  const { t } = useTranslation();
  const { theme, appFont, fontScale } = useTheme();
  const sz = (n: number) => Math.round(n * fontScale);

  const isInvader = item.type === 'invader_added' || item.type === 'invader_updated';
  const canOpen = isInvader && item.invader_id != null;

  const dateLabel = parseServerDate(item.date).toLocaleDateString(getDateLocale(), {
    day: '2-digit',
    month: 'short',
  });

  const title = isInvader ? item.invader_name ?? '?' : item.title ?? '';
  const subtitle = isInvader ? item.city ?? '' : item.body ?? '';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderBottomColor: theme.bgDivider },
        pressed && canOpen && { backgroundColor: theme.bgElement },
      ]}
      onPress={canOpen ? () => onOpenInvader(item.invader_id!) : undefined}
      disabled={!canOpen}
    >
      {/* Thumbnail / icon */}
      {isInvader && item.image_url ? (
        <Image
          source={item.image_url}
          recyclingKey={String(item.invader_id)}
          style={[styles.thumb, { backgroundColor: theme.bgElement, borderColor: theme.border }]}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View style={[styles.thumb, styles.iconThumb, { backgroundColor: theme.bgElement, borderColor: theme.border }]}>
          <MaterialCommunityIcons name={FALLBACK_ICON[item.type]} size={22} color={theme.textMuted} />
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.typeChip, { color: theme.accent, fontFamily: appFont, fontSize: sz(FontSize.xxs) }]}>
            {t(TYPE_LABEL[item.type])}
          </Text>
          <Text style={[styles.date, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(FontSize.xxs) }]}>
            {dateLabel}
          </Text>
        </View>

        <Text numberOfLines={1} style={[styles.title, { color: theme.text, fontFamily: appFont, fontSize: sz(FontSize.sm) }]}>
          {item.type === 'release' && item.version ? `v${item.version}` : title}
        </Text>

        {subtitle ? (
          <Text numberOfLines={2} style={[styles.subtitle, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(FontSize.xs) }]}>
            {subtitle}
          </Text>
        ) : null}

        {isInvader && item.credit_label ? (
          item.source === 'scraper' ? (
            <View style={[styles.sourcePill, { borderColor: theme.accent }]}>
              <MaterialCommunityIcons name="web" size={11} color={theme.accent} />
              <Text style={[styles.sourceText, { color: theme.accent, fontFamily: appFont, fontSize: sz(FontSize.xxs) }]}>
                {item.credit_label}
              </Text>
            </View>
          ) : (
            <Text style={[styles.credit, { color: theme.textMuted, fontFamily: appFont, fontSize: sz(FontSize.xxs) }]}>
              {t('news.by', { name: item.credit_label })}
            </Text>
          )
        ) : null}
      </View>

      {canOpen ? <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  iconThumb: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeChip: { textTransform: 'uppercase', letterSpacing: 0.5 },
  date: {},
  title: { marginTop: 1 },
  subtitle: {},
  credit: { marginTop: 2 },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  sourceText: {},
});
