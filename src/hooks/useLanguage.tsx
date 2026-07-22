import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { LanguageOption } from "@/types";
import i18n, { resolveLanguage, DEFAULT_LANGUAGE, type ResolvedLanguage } from "@/lib/i18n";

// ── Language context ───────────────────────────────────────────────────

const LanguageContext = createContext<ResolvedLanguage>(DEFAULT_LANGUAGE);

/** Wraps the subtree with the resolved locale from `useLanguage`. */
export function LanguageProvider({ value, children }: { value: ResolvedLanguage; children: ReactNode }) {
  return <LanguageContext value={value}>{children}</LanguageContext>;
}

/**
 * Reads the current resolved locale ("en" | "zh-CN") from context.
 * Must be rendered inside a `<LanguageProvider>`.
 *
 * Components rendering translated copy should use `useTranslation()` instead —
 * this is for the few places that need the locale itself, such as passing it to
 * `toLocaleDateString`.
 */
export function useResolvedLanguage(): ResolvedLanguage {
  return useContext(LanguageContext);
}

/**
 * Resolves a LanguageOption to an effective locale, points i18next at it, and
 * keeps the `lang` attribute on <html> in sync.
 *
 * Mirrors `useTheme`, with one difference: there is no OS-level change event for
 * locale (no `matchMedia` equivalent), so "system" is re-read from
 * `navigator.language` only when the setting itself changes.
 */
export function useLanguage(language: LanguageOption): ResolvedLanguage {
  const [resolved, setResolved] = useState<ResolvedLanguage>(() => resolveLanguage(language));

  // Re-resolve when the setting changes
  useEffect(() => {
    setResolved(resolveLanguage(language));
  }, [language]);

  // Point i18next at the resolved locale. i18n.ts already initialized with the
  // persisted value, so on first render this is a no-op rather than a re-render.
  useEffect(() => {
    if (i18n.language !== resolved) {
      void i18n.changeLanguage(resolved);
    }
  }, [resolved]);

  // Keep <html lang> accurate — it drives font fallback and CJK line breaking.
  useEffect(() => {
    document.documentElement.lang = resolved;
  }, [resolved]);

  return resolved;
}
