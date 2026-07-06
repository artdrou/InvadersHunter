/**
 * Flash Import feature — types.
 *
 * Self-contained feature: lets the user bulk-import their flashes from the
 * official FlashInvaders Android app via a PC-side script (or a manual paste
 * fallback). See backend/app/services/flash_import_service.py for the API.
 */
export type FlashImportResponse = {
  imported: number;
  already_flashed: number;
  unknown: string[];
  total_submitted: number;
};
