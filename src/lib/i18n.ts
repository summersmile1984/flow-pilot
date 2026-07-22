import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { LanguageOption } from "@/types";
import { useSettingsStore } from "@/stores/settings-store";
import en from "@/locales/en.json";
import zhCN from "@/locales/zh-CN.json";

/** Locales the app ships a resource bundle for. */
export type ResolvedLanguage = "en" | "zh-CN";

export const DEFAULT_LANGUAGE: ResolvedLanguage = "en";

/**
 * Collapse the stored preference into a locale we actually have a bundle for.
 *
 * Unlike theme there is no `matchMedia` equivalent for locale, so "system" is
 * resolved from `navigator.language` at startup and whenever the setting
 * changes — an OS language change mid-session is not observable.
 */
export function resolveLanguage(option: LanguageOption): ResolvedLanguage {
  if (option === "system") {
    return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : DEFAULT_LANGUAGE;
  }
  return option;
}

// Resolved at module load rather than inside an effect: zustand's persist
// middleware rehydrates synchronously from localStorage, so the right locale is
// already known before the first paint. Leaving it to useLanguage — which runs
// its effect after paint — would flash English for Chinese users on every boot.
const initialLanguage = resolveLanguage(useSettingsStore.getState().language);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    // React escapes interpolated values already.
    escapeValue: false,
  },
  react: {
    // Resources are bundled, and the app has no top-level Suspense boundary —
    // suspending here would blank the frameless window for a frame.
    useSuspense: false,
  },
});

export default i18n;
