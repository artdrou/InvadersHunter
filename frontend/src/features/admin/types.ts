import type { Invader } from '@/features/invaders/types';

export type AdminRequest = {
  id: number;
  invader_id: number | null;
  request_type: 'create' | 'modify';
  status: 'pending' | 'approved' | 'rejected';
  proposed_name: string | null;
  normalized_name: string | null;
  proposed_description: string | null;
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_points: number | null;
  proposed_state: string | null;
  proposed_image_url: string | null;
  proposed_date_pose: string | null;
  request_count: number;
  confidence: number;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
};

export type AdminSubmission = {
  id: number;
  user_id: number;
  username: string | null;
  invader_id: number | null;
  request_type: string;
  status: string;
  proposed_name: string | null;
  proposed_state: string | null;
  proposed_latitude: number | null;
  proposed_longitude: number | null;
  proposed_points: number | null;
  proposed_description: string | null;
  proposed_image_url: string | null;
  proposed_date_pose: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AdminRequestWithInvader = AdminRequest & {
  invader?: Invader;
};

/** Row of the admin user list (GET /users/). */
export type AdminUser = {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

/** Admin view of one user (GET /users/{id}/profile). Dates are naive UTC ISO strings. */
export type AdminUserProfile = AdminUser & {
  language: string;
  notifications_enabled: boolean;
  last_login_at: string | null;
  first_flash_at: string | null;
  last_flash_at: string | null;
  last_request_at: string | null;
  requests_sent: number;
  requests_accepted: number;
  requests_rejected: number;
  requests_pending: number;
  comments: number;
  flashed_invader_ids: number[];
};
