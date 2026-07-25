import { localeConfig, type UiLocale } from "@/lib/i18n/locales";
import { enMessages, type MessageKey } from "@/lib/i18n/messages/en";
import { hiMessages } from "@/lib/i18n/messages/hi";

export type TranslationValues = Record<string, string | number>;
export type Translator = (key: MessageKey, values?: TranslationValues) => string;

const dictionaries = { en: enMessages, hi: hiMessages } as const;

function interpolate(message: string, values: TranslationValues = {}) {
  return message.replace(/\{(\w+)\}/g, (token, key: string) => values[key] === undefined ? token : String(values[key]));
}

export function lookupTranslation(locale: UiLocale, key: string, localizedDictionary: Partial<Record<MessageKey, string>> = dictionaries[locale]) {
  const localized = localizedDictionary[key as MessageKey];
  const fallback = enMessages[key as MessageKey];
  if (!localized && process.env.NODE_ENV !== "production") console.warn(`[i18n] Missing ${locale} translation: ${key}`);
  return localized ?? fallback ?? "";
}

export function translate(locale: UiLocale, key: MessageKey, values?: TranslationValues) {
  return interpolate(lookupTranslation(locale, key), values);
}

export function createTranslator(locale: UiLocale): Translator {
  return (key, values) => translate(locale, key, values);
}

export function formatLocaleDate(locale: UiLocale, value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat(localeConfig(locale).formatLocale, options).format(date);
}

export function formatLocaleNumber(locale: UiLocale, value: number) {
  return new Intl.NumberFormat(localeConfig(locale).formatLocale).format(value);
}

export function dictionaryKeys(locale: UiLocale) {
  return Object.keys(dictionaries[locale]).sort();
}
