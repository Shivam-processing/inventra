"use client";

import { useLanguage } from "@/components/language-provider";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  return <main className="route-state error-state" role="alert"><span aria-hidden="true">!</span><div><strong>{t("route.dashboardError")}</strong><p>{t("errors.tryAgain")}</p><button type="button" onClick={reset}>{t("common.retry")}</button></div></main>;
}
