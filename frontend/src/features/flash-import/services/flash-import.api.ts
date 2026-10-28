import { api, BASE_URL } from '@/services/api-client';
import type { FlashImportResponse } from '../types';
import { webImporterUrl } from '../utils';

export async function importFlashes(names: string[]): Promise<FlashImportResponse> {
  const res = await api.post('/flash-import/', { names });
  return res.data;
}

/** Public URL for the Windows tool (fallback) served by the backend. */
export const SCRIPT_DOWNLOAD_URL = `${BASE_URL}/static/flash_import/HintVaders-FlashImport.exe`;

/** The browser importer for this app's backend (recommended way). */
export const WEB_IMPORTER_URL = webImporterUrl(BASE_URL);
