import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, ButtonLink, Card, EmptyState, ErrorState } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

type InventionCase = {
  id: string;
  title: string;
  development_stage: string;
  publicly_disclosed: boolean;
  previously_sold: boolean;
  previously_filed: boolean;
};

function formatStage(stage: string) {
  return stage.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export default async function DashboardPage() {
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
      <div><p className="eyebrow">WORKSPACE</p><h1>Your inventions.</h1><p>Review existing cases or capture a new idea.</p></div>
      <ButtonLink href="/dashboard/inventions/new" size="large"><span aria-hidden="true">＋</span> New invention</ButtonLink>
    </div>

    <section className="summary-grid" aria-label="Workspace summary">
      <Card><span className="summary-icon violet">⌁</span><div><small>TOTAL INVENTIONS</small><strong>{inventions.length}</strong><p>Saved to your private workspace</p></div></Card>
      <Card><span className="summary-icon amber">↗</span><div><small>PUBLICLY DISCLOSED</small><strong>{disclosedCount}</strong><p>Marked as previously disclosed</p></div></Card>
      <Card><span className="summary-icon green">◇</span><div><small>BEYOND CONCEPT</small><strong>{prototypeCount}</strong><p>Prototype, testing, or production</p></div></Card>
    </section>

    <section className="projects-section" id="projects">
      <div className="section-row"><div><h2>Your inventions</h2><p>Cases owned by your account</p></div></div>
      {error ? <ErrorState /> : inventions.length === 0 ? <div className="dashboard-empty"><EmptyState /><ButtonLink href="/dashboard/inventions/new">Create your first invention</ButtonLink></div> : <div className="project-grid">
        {inventions.map((invention) => {
          const priorActivity = [invention.publicly_disclosed, invention.previously_sold, invention.previously_filed].filter(Boolean).length;
          return <Card className="project-card" key={invention.id}>
            <div className="project-card-top"><span className="project-glyph" aria-hidden="true">◇</span><Badge tone={invention.development_stage === "concept" ? "neutral" : "success"}>{formatStage(invention.development_stage)}</Badge></div>
            <h3><Link href={`/dashboard/inventions/${invention.id}`}>{invention.title}</Link></h3><p>Private invention case</p>
            <div className="project-note"><span aria-hidden="true">{priorActivity ? "!" : "✓"}</span>{priorActivity ? `${priorActivity} prior activity ${priorActivity === 1 ? "answer" : "answers"} marked yes` : "No prior activity reported"}</div>
          </Card>;
        })}
        <Link className="new-project-card" href="/dashboard/inventions/new"><span>＋</span><strong>Start a new invention</strong><small>Describe an idea and build from there</small></Link>
      </div>}
    </section>
  </DashboardShell>;
}
