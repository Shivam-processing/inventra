import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Badge, ButtonLink, Card } from "@/components/ui";

const steps = [
  ["01", "Describe invention", "Explain the problem, your solution, and what makes it different."],
  ["02", "Upload images", "Add real photos, diagrams, or rough sketches for visual context."],
  ["03", "AI analysis", "Turn your materials into structured components and key features."],
  ["04", "Clarification", "Resolve gaps through focused questions before moving forward."],
  ["05", "Patent search", "Search for related patents using the reviewed feature set."],
  ["06", "Overlap report", "Compare shared and distinguishing features in one clear view."],
  ["07", "Draft", "Generate and edit a structured patent draft in your workspace."],
  ["08", "Download", "Export your reviewed draft as DOCX or PDF."],
];

function ProductPreview() {
  return (
    <div className="preview-scene">
      <div className="preview-float float-features"><span>✓</span> Features extracted</div>
      <div className="preview-float float-prior-art"><span>⌕</span> Prior art found</div>
      <div className="preview-float float-draft"><span>✎</span> Draft ready</div>
      <div className="product-preview" aria-label="Inventra workspace preview">
        <div className="preview-topbar">
          <span className="preview-mark">IN</span>
          <span className="preview-title">Portable water purifier</span>
          <Badge tone="success">Analysis complete</Badge>
        </div>
        <div className="preview-layout">
          <aside className="preview-rail" aria-hidden="true">
            {["Overview", "Features", "Questions", "Prior art", "Draft"].map((item, index) => (
              <span className={index === 1 ? "active" : ""} key={item}>{item}</span>
            ))}
          </aside>
          <div className="preview-content">
            <div className="preview-heading">
              <div><small>AI ANALYSIS</small><strong>12 key features identified</strong></div>
              <span>Review</span>
            </div>
            <div className="feature-list">
              <div><i>01</i><span><strong>Dual-stage filtration</strong><small>Activated carbon and hollow-fiber membrane</small></span><Badge>Core</Badge></div>
              <div><i>02</i><span><strong>Manual pressure chamber</strong><small>Operates without an external power source</small></span><Badge>Core</Badge></div>
              <div><i>03</i><span><strong>Replaceable cartridge</strong><small>Tool-free twist-lock mechanism</small></span><Badge tone="neutral">Supporting</Badge></div>
            </div>
            <div className="preview-note"><span>?</span><p><strong>1 clarification needed</strong><small>How does the pressure-release valve respond to a blockage?</small></p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="site-page">
      <SiteHeader />
      <main>
        <section className="hero section-shell">
          <div className="hero-copy">
            <Badge tone="accent">Patent work, made understandable</Badge>
            <h1>Turn your invention into a <em>patent-ready</em> draft.</h1>
            <p>Inventra guides you from a rough idea and sketches to reviewed features, relevant prior art, and an editable patent draft.</p>
            <div className="hero-actions">
              <ButtonLink href="/dashboard" size="large">Start your invention <span aria-hidden="true">→</span></ButtonLink>
              <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="hero-reassurance"><span>✓</span> You stay in control at every step</p>
          </div>
          <ProductPreview />
        </section>

        <section className="trust-strip" aria-label="Product benefits">
          <div className="section-shell trust-items">
            <span><i>✓</i><strong>Structured guidance</strong><small>From idea to draft</small></span>
            <span><i>⌕</i><strong>Evidence-led search</strong><small>Compare features clearly</small></span>
            <span><i>✎</i><strong>Always editable</strong><small>Review before export</small></span>
            <span><i>↗</i><strong>Portable output</strong><small>DOCX and PDF ready</small></span>
          </div>
        </section>

        <section className="workflow section-shell" id="how-it-works">
          <div className="section-intro">
            <Badge tone="accent">How Inventra works</Badge>
            <h2>A clear path from idea to draft</h2>
            <p>Each stage builds on information you have reviewed, so the result stays grounded in your invention.</p>
          </div>
          <div className="workflow-grid">
            {steps.map(([number, title, description]) => (
              <Card className="step-card" key={number}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="control-section">
          <div className="section-shell control-grid">
            <div>
              <Badge tone="success">Built for careful work</Badge>
              <h2>AI assists. You decide.</h2>
              <p>Inventra makes uncertainty visible instead of guessing. Correct extracted features, answer clarifying questions, and edit every part of your draft.</p>
              <ul>
                <li><span>✓</span> Review every extracted component and feature</li>
                <li><span>✓</span> See where information needs clarification</li>
                <li><span>✓</span> Compare overlap before drafting</li>
              </ul>
            </div>
            <Card className="review-card">
              <span className="review-label">REVIEW CHECKPOINT</span>
              <h3>Does this match your invention?</h3>
              <p>“The device uses a spring-loaded valve to regulate pressure automatically.”</p>
              <div><button type="button">Edit feature</button><button type="button">Looks correct ✓</button></div>
              <small>Nothing moves forward until you review it.</small>
            </Card>
          </div>
        </section>

        <section className="cta section-shell">
          <div><Badge tone="accent">Ready when you are</Badge><h2>Give your invention a clear next step.</h2><p>Start with what you know. Inventra will help you structure the rest.</p></div>
          <ButtonLink href="/dashboard" size="large">Open your workspace <span aria-hidden="true">→</span></ButtonLink>
        </section>
      </main>
      <footer className="site-footer section-shell"><Link href="/" className="brand"><span>IN</span> Inventra</Link><p>Patent assistance for inventors who want clarity.</p><small>Inventra is not a law firm and does not provide legal advice.</small></footer>
    </div>
  );
}
