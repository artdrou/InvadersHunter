import { getDateLocale } from "@/services/i18n";

/** Locale-aware dd/mm/yyyy, or "--" when the date is missing. */
export function formatDate(iso?: string): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString(getDateLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
