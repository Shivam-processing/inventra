import { DashboardShell } from "@/components/dashboard-shell";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, LoadingState, TextInput } from "@/components/ui";

const projects = [
  { title: "Portable water purifier", updated: "Updated 2 hours ago", stage: "Clarification", progress: 42, tone: "accent" as const, note: "1 question needs your input" },
  { title: "Adaptive bicycle light", updated: "Updated yesterday", stage: "Patent search", progress: 63, tone: "default" as const, note: "Searching related patents" },
  { title: "Fold-flat plant carrier", updated: "Updated Jul 16", stage: "Draft", progress: 88, tone: "success" as const, note: "Draft ready for review" },
];

export default function DashboardPage() {
  return <DashboardShell>
    <div className="dashboard-heading">
      <div><p className="eyebrow">WORKSPACE</p><h1>Good morning, Alex.</h1><p>Pick up where you left off or start something new.</p></div>
      <ButtonLink href="#projects" size="large"><span aria-hidden="true">＋</span> New invention</ButtonLink>
    </div>

    <section className="summary-grid" aria-label="Workspace summary">
      <Card><span className="summary-icon violet">⌁</span><div><small>ACTIVE PROJECTS</small><strong>3</strong><p>Across three workflow stages</p></div></Card>
      <Card><span className="summary-icon amber">?</span><div><small>NEEDS ATTENTION</small><strong>1</strong><p>Clarification waiting for you</p></div></Card>
      <Card><span className="summary-icon green">✓</span><div><small>DRAFTS READY</small><strong>1</strong><p>Ready to review and edit</p></div></Card>
    </section>

    <section className="projects-section" id="projects">
      <div className="section-row"><div><h2>Your inventions</h2><p>All active patent-assistance projects</p></div><TextInput label="Search projects" placeholder="Search inventions…" type="search" /></div>
      <div className="project-grid">
        {projects.map((project) => <Card className="project-card" key={project.title}>
          <div className="project-card-top"><span className="project-glyph" aria-hidden="true">◇</span><Badge tone={project.tone}>{project.stage}</Badge><button aria-label={`More options for ${project.title}`} type="button">•••</button></div>
          <h3>{project.title}</h3><p>{project.updated}</p>
          <div className="progress-meta"><span>Progress</span><strong>{project.progress}%</strong></div>
          <div className="progress-track"><span style={{ width: `${project.progress}%` }} /></div>
          <div className="project-note"><span aria-hidden="true">{project.progress === 88 ? "✓" : project.progress === 63 ? "⌕" : "?"}</span>{project.note}</div>
        </Card>)}
        <button className="new-project-card" type="button"><span>＋</span><strong>Start a new invention</strong><small>Describe an idea and build from there</small></button>
      </div>
    </section>

    <section className="workflow-status">
      <div className="section-row"><div><h2>How your work progresses</h2><p>Eight focused stages, with your review built in.</p></div></div>
      <Card className="mini-flow">
        {["Describe", "Images", "Analysis", "Clarify", "Search", "Overlap", "Draft", "Download"].map((label, index) => <div key={label}><span>{index + 1}</span><small>{label}</small></div>)}
      </Card>
    </section>

    <details className="state-gallery"><summary>Reusable interface states</summary><div><LoadingState /><EmptyState /><ErrorState /></div></details>
  </DashboardShell>;
}
