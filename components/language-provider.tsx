"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { UiLocale } from "@/lib/i18n/locales";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

type LanguageContextValue = { locale: UiLocale; t: Translator };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ locale, children }: { locale: UiLocale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("LanguageProvider is missing.");
  return value;
}
