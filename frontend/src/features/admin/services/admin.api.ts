import { api } from '@/services/api-client';
import type { AdminRequest, AdminSubmission } from '../types';
import type { Invader } from '@/features/invaders/types';

export async function fetchAdminRequests(params?: {
  status?: string;
  request_type?: string;
}): Promise<AdminRequest[]> {
  const res = await api.get('/admin-requests/', { params });
  return res.data;
}

export async function fetchAdminRequest(id: number): Promise<AdminRequest> {
  const res = await api.get(`/admin-requests/${id}`);
  return res.data;
}

export async function fetchAdminSubmissions(adminRequestId: number): Promise<AdminSubmission[]> {
  const res = await api.get(`/admin-requests/${adminRequestId}/submissions`);
  return res.data;
}

export async function fetchInvader(id: number): Promise<Invader> {
  const res = await api.get(`/invaders/${id}`);
  return res.data;
}

export async function approveAdminRequest(
  id: number,
  overrideCoords?: { latitude: number; longitude: number },
): Promise<void> {
  await api.post(`/admin-requests/${id}/approve`, {
    override_latitude: overrideCoords?.latitude ?? null,
    override_longitude: overrideCoords?.longitude ?? null,
  });
}

export async function rejectAdminRequest(id: number): Promise<void> {
  await api.post(`/admin-requests/${id}/reject`);
}
