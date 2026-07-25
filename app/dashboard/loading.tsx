import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator } from "@/lib/i18n/translate";

export default async function DashboardLoading() {
  const t = createTranslator(await getLocale());
  return <main className="route-state" role="status"><span className="spinner" aria-hidden="true" /><div><strong>{t("dashboard.loadingTitle")}</strong><p>{t("dashboard.loadingDescription")}</p></div></main>;
}
