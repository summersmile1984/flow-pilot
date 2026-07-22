import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";

/**
 * Initialize i18next for component tests.
 *
 * Deliberately does NOT import `@/lib/i18n` — that module reads the persisted
 * language from the zustand settings store, which needs localStorage. Tests run
 * in the `node` environment where localStorage is unavailable, so this pins the
 * English bundle directly and keeps assertions on English copy meaningful.
 *
 * Without this, `useTranslation()` in a component under test would return raw
 * key strings and every copy assertion would fail.
 */
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
