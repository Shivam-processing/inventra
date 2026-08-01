import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { FirstInventionOnboarding } from "@/components/first-invention-onboarding";
import { ButtonLink, ErrorState } from "@/components/ui";
import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator } from "@/lib/i18n/translate";
import { DASHBOARD_FEATURES, dashboardInventionProgress } from "@/lib/onboarding/dashboard";
import { createClient } from "@/lib/supabase/server";

type InventionCase = { id: string; title: string; development_stage: string; ai_status: string | null; updated_at: string | null };

function formatDate(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date) : "Date unavailable";
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = createTranslator(locale);
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/login");
  const fullName = (authData.claims as { user_metadata?: { full_name?: string } }).user_metadata?.full_name?.trim();
  const firstName = fullName?.split(/\s+/)[0];
  const { data, error } = await supabase.from("invention_cases").select("id,title,development_stage,ai_status,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
  const inventions = (data ?? []) as InventionCase[];
  const recent = inventions.slice(0, 3);

  const current = recent[0];
  const currentProgress = current ? dashboardInventionProgress(current.ai_status) : null;

  return <DashboardShell><div className="home-dashboard workshop-dashboard">
    <header className="dashboard-welcome-line"><div><p className="eyebrow">{t("dashboard.workspaceKicker")}</p><h1>{firstName ? t("dashboard.welcomeBackName", { name: firstName }) : t("dashboard.welcomeBack")}</h1><p>{t("dashboard.orientation")}</p></div><ButtonLink href="/dashboard/inventions/new">{t("dashboard.startPrimary")}</ButtonLink></header>
    {error ? <ErrorState title={t("dashboard.loadErrorTitle")} description={t("dashboard.loadErrorDescription")} /> : current && currentProgress ? <section className="dashboard-priority-card" aria-labelledby="priority-invention-title">
      <div className="priority-summary"><span className="priority-mark" aria-hidden="true">IN</span><div><p className="eyebrow">{t("dashboard.inProgress")}</p><h2 id="priority-invention-title">{current.title}</h2><p>{t(currentProgress.stageKey)} · {t("dashboard.updated", { date: formatDate(current.updated_at) })}</p></div></div>
      <div className="priority-progress"><div><span>{t("dashboard.currentPhase")}</span><strong>{t(currentProgress.stageKey)}</strong></div><div className="recent-progress" aria-label={t("dashboard.progressLabel", { percent: currentProgress.percent })}><i><b style={{ width: `${currentProgress.percent}%` }} /></i><span>{currentProgress.percent}%</span></div></div>
      <div className="priority-recommendation"><span aria-hidden="true">→</span><p><strong>{t("dashboard.recommendedNext")}</strong>{t(currentProgress.recommendationKey)}</p></div>
      <ButtonLink href={`/dashboard/inventions/${current.id}?section=${currentProgress.section}`}>{t(currentProgress.actionKey)}</ButtonLink>
    </section> : !error && <FirstInventionOnboarding />}

    <div className="dashboard-home-grid">
      <section className="recent-inventions" id="recent-inventions" aria-labelledby="recent-title"><header><div><h2 id="recent-title">{t("dashboard.recent")}</h2><p>{t("dashboard.recentDescription")}</p></div><Link href="/dashboard/inventions">{t("dashboard.viewAll")}</Link></header>
        {recent.length ? <div>{recent.map((invention) => { const progress = dashboardInventionProgress(invention.ai_status); return <article key={invention.id}><div><span>{invention.development_stage.replaceAll("_", " ")}</span><h3>{invention.title}</h3><p>{t(progress.stageKey)} · {t("dashboard.updated", { date: formatDate(invention.updated_at) })}</p></div><div className="recent-progress" aria-label={t("dashboard.progressLabel", { percent: progress.percent })}><i><b style={{ width: `${progress.percent}%` }} /></i><span>{progress.percent}%</span></div><Link href={`/dashboard/inventions/${invention.id}`}>{t("dashboard.continue")}<span aria-hidden="true">→</span></Link></article>; })}</div> : <div className="compact-empty"><p>{t("dashboard.emptyTitle")}</p><Link href="/dashboard/inventions/new">{t("dashboard.createFirst")}</Link></div>}
      </section>
      <section className="dashboard-quick-tools" aria-labelledby="quick-tools-title"><header><h2 id="quick-tools-title">{t("dashboard.quickTools")}</h2><p>{t("dashboard.quickToolsDescription")}</p></header><div>{DASHBOARD_FEATURES.map((feature, index) => <Link href={feature.href} key={feature.titleKey}><span aria-hidden="true">{["§", "₹", "⚙", "™"][index]}</span><span><strong>{t(feature.titleKey)}</strong><small>{t(feature.requiresInvention ? "dashboard.requiresInvention" : "dashboard.noInventionRequired")}</small></span><b aria-hidden="true">→</b></Link>)}</div></section>
    </div>
  </div></DashboardShell>;
}
