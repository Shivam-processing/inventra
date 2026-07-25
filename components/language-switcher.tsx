"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { localeConfig, localeSwitchTarget, UI_LOCALE_COOKIE, UI_LOCALES, type UiLocale } from "@/lib/i18n/locales";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, t } = useLanguage();

  function changeLocale(nextLocale: UiLocale) {
    if (nextLocale === locale) return;
    const currentUrl = localeSwitchTarget(window.location.pathname, window.location.search, window.location.hash);
    document.cookie = `${UI_LOCALE_COOKIE}=${encodeURIComponent(nextLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const config = localeConfig(nextLocale);
    document.documentElement.lang = config.htmlLang;
    document.documentElement.dir = config.dir;
    router.refresh();
    window.requestAnimationFrame(() => {
      const refreshedUrl = localeSwitchTarget(window.location.pathname, window.location.search, window.location.hash);
      if (refreshedUrl !== currentUrl) window.history.replaceState(null, "", currentUrl);
    });
  }

  return <label className={compact ? "language-switcher language-switcher-compact" : "language-switcher"}>
    <span className="sr-only">{t("language.label")}</span>
    <span aria-hidden="true">文</span>
    <select aria-label={t("language.label")} value={locale} onChange={(event) => changeLocale(event.target.value as UiLocale)}>
      {UI_LOCALES.map((option) => <option value={option.code} lang={option.htmlLang} key={option.code}>{option.label}</option>)}
    </select>
  </label>;
}
