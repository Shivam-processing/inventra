import "server-only";

import { cookies } from "next/headers";
import { parseLocaleCookie, UI_LOCALE_COOKIE } from "@/lib/i18n/locales";

export async function getLocale() {
  const cookieStore = await cookies();
  return parseLocaleCookie(cookieStore.get(UI_LOCALE_COOKIE)?.value);
}
