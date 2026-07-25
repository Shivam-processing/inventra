export const DEFAULT_VOICE_LANGUAGE = "en-IN" as const;

export const VOICE_LANGUAGES = [
  { code: "en-IN", label: "English (India)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali" },
  { code: "mr-IN", label: "Marathi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "pa-IN", label: "Punjabi" },
] as const;

export type VoiceLanguageCode = typeof VOICE_LANGUAGES[number]["code"];

const supportedCodes = new Set<string>(VOICE_LANGUAGES.map((language) => language.code));

export function isSupportedVoiceLanguage(value: unknown): value is VoiceLanguageCode {
  return typeof value === "string" && supportedCodes.has(value);
}

export function normalizePreferredLanguage(value: unknown): VoiceLanguageCode {
  return isSupportedVoiceLanguage(value) ? value : DEFAULT_VOICE_LANGUAGE;
}
