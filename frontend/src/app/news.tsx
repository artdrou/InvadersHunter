import { useCallback, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/theme-context';
import { Spacing, FontSize, ButtonFont, ButtonFontSize, BorderRadius } from '@/constants/theme';
import { useNewsData, useNewsStore, NewsListItem, newsItemKey } from '@/features/news';
import { useLocateStore } from '@/features/map';

export default function NewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, appFont } = useTheme();

  const { items, loading, refreshing, loadingMore, hasMore, error, refresh, loadMore } = useNewsData();
  const markAllSeen = useNewsStore((s) => s.markAllSeen);
  const setPendingInvader = useLocateStore((s) => s.setPendingInvader);

  // Once the newest items are loaded, clear the unread badge.
  useEffect(() => {
    if (!loading && items.length > 0) markAllSeen();
  }, [loading, items.length, markAllSeen]);

  const openInvader = useCallback(
    (id: number) => {
      setPendingInvader(id);
      router.push('/(tabs)/map');
    },
    [setPendingInvader, router],
  );

  const footer =
    items.length > 0 && hasMore ? (
      <Pressable
        onPress={loadMore}
        disabled={loadingMore}
        style={({ pressed }) => [styles.moreBtn, { borderColor: theme.border }, pressed && styles.pressed]}
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Text style={[styles.moreText, { color: theme.accent, fontFamily: appFont }]}>{t('news.more')}</Text>
        )}
      </Pressable>
    ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={[styles.backText, { color: theme.textMuted }]}>{`< ${t('common.back')}`}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.accent, fontFamily: appFont }]}>{t('news.title')}</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: appFont }]}>{t('common.noInternet')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={newsItemKey}
          renderItem={({ item }) => <NewsListItem item={item} onOpenInvader={openInvader} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: theme.textMuted, fontFamily: appFont }]}>{t('news.empty')}</Text>
            </View>
          }
          ListFooterComponent={footer}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: ButtonFont, fontSize: ButtonFontSize.md },
  title: { fontSize: ButtonFontSize.xxl, letterSpacing: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  emptyContainer: { flexGrow: 1 },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  listContent: { paddingBottom: Spacing.six },
  moreBtn: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.four,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  moreText: { fontSize: ButtonFontSize.lg },
  pressed: { opacity: 0.6 },
});
