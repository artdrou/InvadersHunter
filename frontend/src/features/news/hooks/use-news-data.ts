import { useCallback, useEffect, useState } from 'react';
import { fetchNews } from '../services/news.api';
import { useNewsStore } from '../store';
import { newsItemKey, type NewsItem } from '../types';

const PAGE = 30;

/**
 * Drives the News screen: initial 30-day window, pull-to-refresh, and a
 * cursor-paginated "Plus" (load older than the oldest loaded item).
 */
export function useNewsData() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await fetchNews(undefined, PAGE);
      setItems(data);
      setHasMore(true); // there may be history before the 30-day window
      useNewsStore.getState().setItems(data); // keep the badge cache fresh
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await fetchNews(items[items.length - 1].date, PAGE);
      setItems((prev) => {
        const seen = new Set(prev.map(newsItemKey));
        return [...prev, ...older.filter((i) => !seen.has(newsItemKey(i)))];
      });
      if (older.length < PAGE) setHasMore(false);
    } catch {
      // ignore — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [items, loadingMore]);

  return { items, loading, refreshing, loadingMore, hasMore, error, refresh, loadMore };
}
