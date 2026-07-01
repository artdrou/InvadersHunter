export type NewsType = 'invader_added' | 'invader_updated' | 'announcement' | 'release';
export type NewsSource = 'community' | 'admin' | 'scraper';

/** One entry in the unified News feed (mirror of the backend NewsItemOut). */
export type NewsItem = {
  type: NewsType;
  date: string; // ISO, naive UTC from the backend

  // Invader events
  source?: NewsSource | null;
  credit_label?: string | null; // username | "Equipe" | "invader-spotter.art"
  invader_id?: number | null;
  invader_name?: string | null;
  city?: string | null;
  image_url?: string | null;

  // Announcements / releases
  title?: string | null;
  body?: string | null;
  version?: string | null;
};

/** Stable-enough key for lists / de-dup at pagination boundaries. */
export function newsItemKey(item: NewsItem): string {
  return `${item.type}|${item.date}|${item.invader_id ?? item.version ?? item.title ?? ''}`;
}

/** The backend serialises naive UTC (no timezone). Parse it as UTC, not local. */
export function parseServerDate(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}
