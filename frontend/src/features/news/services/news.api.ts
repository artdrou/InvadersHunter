import { api } from '@/services/api-client';
import type { NewsItem } from '../types';

/**
 * Fetch the news feed.
 * No `before` → last 30 days. Pass `before` (ISO date of the oldest loaded item)
 * to page into older history.
 */
export async function fetchNews(before?: string, limit = 30): Promise<NewsItem[]> {
  const params: Record<string, string | number> = { limit };
  if (before) params.before = before;
  const res = await api.get('/news/', { params });
  return res.data;
}
