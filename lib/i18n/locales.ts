export const UI_LOCALE_COOKIE = "inventra_locale";
export const DEFAULT_UI_LOCALE = "en" as const;
export const UI_LOCALES = [
  { code: "en", label: "English", htmlLang: "en", formatLocale: "en-IN", dir: "ltr" },
  { code: "hi", label: "हिन्दी", htmlLang: "hi", formatLocale: "hi-IN", dir: "ltr" },
] as const;

export type UiLocale = typeof UI_LOCALES[number]["code"];

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && UI_LOCALES.some((locale) => locale.code === value);
}

export function parseLocaleCookie(value: unknown): UiLocale {
  return isUiLocale(value) ? value : DEFAULT_UI_LOCALE;
}

export function localeConfig(locale: UiLocale) {
  return UI_LOCALES.find((item) => item.code === locale) ?? UI_LOCALES[0];
}

export function localeSwitchTarget(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}
