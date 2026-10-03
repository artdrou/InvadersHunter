import { getDateLocale } from '@/services/i18n';
import type { Invader } from '@/features/invaders/types';
import type { AdminRequest } from './types';

/** Display name for an admin request: proposed name (create requests, or modify
 * requests that propose a rename), falling back to the target invader's current
 * name, then to a bare id. */
export function resolveInvaderName(req: AdminRequest, invaders: Invader[]): string {
  if (req.proposed_name) return req.proposed_name;
  const invader = invaders.find((i) => i.id === req.invader_id);
  if (invader) return invader.name;
  return `#${req.invader_id ?? req.id}`;
}

/** Backend datetimes are naive UTC ISO strings: parse as UTC, render in the app locale. */
export function formatServerDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '--';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString(getDateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
