import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DeleteInventionDialog } from "@/components/delete-invention-dialog";
import { Badge, ButtonLink, Card, EmptyState, ErrorState } from "@/components/ui";
import { getLocale } from "@/lib/i18n/get-locale";
import type { MessageKey } from "@/lib/i18n/messages/en";
import { createTranslator, formatLocaleNumber } from "@/lib/i18n/translate";
import { createClient } from "@/lib/supabase/server";

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

export default async function InventionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const patentWorkspaceRequested = query.intent === "patent-workspace";
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
    .order("updated_at", { ascending: false });
  const inventions = (data ?? []) as InventionCase[];
  if (!error && patentWorkspaceRequested && inventions[0]) redirect(`/dashboard/inventions/${inventions[0].id}?section=overview`);

  return <DashboardShell>
    <div className="dashboard-heading"><div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>{t("navigation.inventions")}</h1><p>Open an invention, continue its recommended workflow step, or permanently delete it.</p></div><ButtonLink href="/dashboard/inventions/new" size="large"><span aria-hidden="true">＋</span> {t("dashboard.newInvention")}</ButtonLink></div>
    {patentWorkspaceRequested && inventions.length === 0 && <div className="selection-prompt" role="status"><strong>Select an invention to open the patent workspace</strong><p>Create your first invention record, then Inventra will guide you through analysis, feature review, prior-art search and drafting.</p></div>}
    <section className="projects-section inventions-index" aria-labelledby="inventions-heading">
      <div className="section-row"><div><h2 id="inventions-heading">{t("dashboard.title")}</h2><p>{t("dashboard.cases")}</p></div></div>
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
      </div>}
    </section>
  </DashboardShell>;
}
