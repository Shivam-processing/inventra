import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_UI_LOCALE, isUiLocale, localeSwitchTarget, parseLocaleCookie } from "./locales";
import { dictionaryKeys, formatLocaleDate, lookupTranslation, translate } from "./translate";

describe("website localization", () => {
  it("validates supported locales and rejects unsupported values", () => {
    assert.equal(isUiLocale("en"), true);
    assert.equal(isUiLocale("hi"), true);
    assert.equal(isUiLocale("fr"), false);
  });

  it("falls back to English for missing or malformed cookies", () => {
    assert.equal(parseLocaleCookie(undefined), DEFAULT_UI_LOCALE);
    assert.equal(parseLocaleCookie("../../hi"), DEFAULT_UI_LOCALE);
  });

  it("looks up English and Hindi messages", () => {
    assert.equal(translate("en", "navigation.dashboard"), "Overview");
    assert.equal(translate("hi", "navigation.dashboard"), "अवलोकन");
  });

  it("falls back to English when a Hindi key is missing", () => {
    assert.equal(lookupTranslation("hi", "navigation.dashboard", {}), "Overview");
  });

  it("keeps locale dictionaries key-complete", () => {
    assert.deepEqual(dictionaryKeys("hi"), dictionaryKeys("en"));
  });

  it("formats dates with the selected locale", () => {
    const value = "2026-07-25T10:30:00.000Z";
    assert.notEqual(formatLocaleDate("en", value), formatLocaleDate("hi", value));
  });

  it("preserves section queries and hashes when switching", () => {
    assert.equal(localeSwitchTarget("/dashboard/inventions/abc", "?section=patent-search", "#result"), "/dashboard/inventions/abc?section=patent-search#result");
  });
});
