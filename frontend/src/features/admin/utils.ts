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
