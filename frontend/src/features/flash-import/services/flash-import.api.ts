import { api, BASE_URL } from '@/services/api-client';
import type { FlashImportResponse } from '../types';

export async function importFlashes(names: string[]): Promise<FlashImportResponse> {
  const res = await api.post('/flash-import/', { names });
  return res.data;
}

/** Public URL for the PC-side Python script served by the backend. */
export const SCRIPT_DOWNLOAD_URL = `${BASE_URL}/static/flash_import/InvadersHunter-FlashImport.exe`;
