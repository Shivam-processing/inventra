import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventionForm } from "@/components/invention-form";
import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator } from "@/lib/i18n/translate";

export const metadata: Metadata = { title: "New invention" };

export default async function NewInventionPage() {
  const t = createTranslator(await getLocale());
  return <DashboardShell>
    <div className="new-invention-heading">
      <Link href="/dashboard" aria-label={t("form.backDashboard")}>←</Link>
      <div><p className="eyebrow">{t("form.newEyebrow")}</p><h1>{t("form.newTitle")}</h1><p>{t("form.wizardPageDescription")}</p></div>
    </div>
    <InventionForm />
  </DashboardShell>;
}
