import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DeleteInventionDialog } from "@/components/delete-invention-dialog";
import { ProgressPipeline } from "@/components/progress-pipeline";
import { Badge, ButtonLink, Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator, formatLocaleNumber } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages/en";

type InventionCase = {
  id: string;
  title: string;
  development_stage: string;
  publicly_disclosed: boolean;
  previously_sold: boolean;
  previously_filed: boolean;
};

const stageKeys: Record<string, MessageKey> = {
  concept: "form.stageConcept",
  prototype: "form.stagePrototype",
  testing: "form.stageTesting",
  production: "form.stageProduction",
};

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = createTranslator(locale);
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("invention_cases")
    .select("id,title,development_stage,publicly_disclosed,previously_sold,previously_filed")
    .eq("user_id", userId)
    .order("id", { ascending: false });

  const inventions = (data ?? []) as InventionCase[];
  const disclosedCount = inventions.filter((item) => item.publicly_disclosed).length;
  const prototypeCount = inventions.filter((item) => item.development_stage !== "concept").length;

  return <DashboardShell>
    <div className="dashboard-heading">
      <div><p className="eyebrow">{t("dashboard.eyebrow")}</p><h1>{t("dashboard.title")}</h1><p>{t("dashboard.description")}</p></div>
      <ButtonLink href="/dashboard/inventions/new" size="large"><span aria-hidden="true">＋</span> {t("dashboard.newInvention")}</ButtonLink>
    </div>

    <section className="summary-grid" aria-label={t("dashboard.summary")}>
      <Card><span className="summary-icon sky">⌁</span><div><small>{t("dashboard.total")}</small><strong>{formatLocaleNumber(locale, inventions.length)}</strong><p>{t("dashboard.totalDetail")}</p></div></Card>
      <Card><span className="summary-icon amber">↗</span><div><small>{t("dashboard.disclosed")}</small><strong>{formatLocaleNumber(locale, disclosedCount)}</strong><p>{t("dashboard.disclosedDetail")}</p></div></Card>
      <Card><span className="summary-icon green">◇</span><div><small>{t("dashboard.beyondConcept")}</small><strong>{formatLocaleNumber(locale, prototypeCount)}</strong><p>{t("dashboard.beyondConceptDetail")}</p></div></Card>
    </section>

    <ProgressPipeline />

    <section className="projects-section" id="projects">
      <div className="section-row"><div><h2>{t("dashboard.title")}</h2><p>{t("dashboard.cases")}</p></div></div>
      {error ? <ErrorState title={t("dashboard.loadErrorTitle")} description={t("dashboard.loadErrorDescription")} /> : inventions.length === 0 ? <div className="dashboard-empty"><EmptyState title={t("dashboard.emptyTitle")} description={t("dashboard.emptyDescription")} /><ButtonLink href="/dashboard/inventions/new">{t("dashboard.createFirst")}</ButtonLink></div> : <div className="project-grid">
        {inventions.map((invention) => {
          const priorActivity = [invention.publicly_disclosed, invention.previously_sold, invention.previously_filed].filter(Boolean).length;
          return <Card className="project-card" key={invention.id}>
            <div className="project-card-top"><span className="project-glyph" aria-hidden="true">◇</span><Badge tone={invention.development_stage === "concept" ? "neutral" : "success"}>{t(stageKeys[invention.development_stage] ?? "form.stageConcept")}</Badge></div>
            <h3>{invention.title}</h3><p>{t("dashboard.privateCase")}</p>
            <div className="project-note"><span aria-hidden="true">{priorActivity ? "!" : "✓"}</span>{priorActivity ? t(priorActivity === 1 ? "dashboard.priorOne" : "dashboard.priorMany", { count: formatLocaleNumber(locale, priorActivity) }) : t("dashboard.noPrior")}</div>
            <div className="project-card-actions"><Link className="project-continue" href={`/dashboard/inventions/${invention.id}`}>Continue</Link><Link href={`/dashboard/inventions/${invention.id}?section=overview`}>Open</Link><DeleteInventionDialog compact inventionId={invention.id} inventionTitle={invention.title} /></div>
          </Card>;
        })}
        <Link className="new-project-card" href="/dashboard/inventions/new"><span>＋</span><strong>{t("dashboard.startNew")}</strong><small>{t("dashboard.startNewDetail")}</small></Link>
      </div>}
    </section>
  </DashboardShell>;
}
