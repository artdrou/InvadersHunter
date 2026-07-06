/* eslint-disable import/no-named-as-default-member -- i18n.use()/.changeLanguage()/.t() is idiomatic i18next */
/**
 * i18n service — wires i18next with device-locale auto-detection and
 * AsyncStorage persistence of the user's manual override.
 *
 * Usage:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <Text>{t('common.cancel')}</Text>
 *
 * To add a language: create src/locales/<code>.json, import it below, add
 * to `resources`, and add a label to `SUPPORTED_LANGUAGES`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import fr from '@/locales/fr.json';
import en from '@/locales/en.json';

const STORAGE_KEY = 'app-language';
export const FALLBACK_LANGUAGE = 'fr';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', labelKey: 'languageNames.fr' },
  { code: 'en', labelKey: 'languageNames.en' },
] as const;
export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

function detectDeviceLanguage(): LanguageCode {
  const locales = Localization.getLocales();
  for (const l of locales) {
    const code = l.languageCode?.toLowerCase();
    if (code && SUPPORTED_LANGUAGES.some((s) => s.code === code)) {
      return code as LanguageCode;
    }
  }
  return FALLBACK_LANGUAGE;
}

export async function initI18n(): Promise<void> {
  let saved: string | null = null;
  try { saved = await AsyncStorage.getItem(STORAGE_KEY); } catch {}

  const initialLang: LanguageCode =
    (saved && SUPPORTED_LANGUAGES.some((s) => s.code === saved))
      ? (saved as LanguageCode)
      : detectDeviceLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLang,
      fallbackLng: FALLBACK_LANGUAGE,
      interpolation: { escapeValue: false },
      returnNull: false,
      compatibilityJSON: 'v4',
    });
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  await i18n.changeLanguage(code);
  try { await AsyncStorage.setItem(STORAGE_KEY, code); } catch {}
}

export function getCurrentLanguage(): LanguageCode {
  return (i18n.language as LanguageCode) ?? FALLBACK_LANGUAGE;
}

export function getDateLocale(): string {
  return i18n.t('dates.locale') || 'fr-FR';
}

export default i18n;
