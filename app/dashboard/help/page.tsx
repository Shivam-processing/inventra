import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";

export const metadata: Metadata = { title: "Help centre" };

const guides = [
  { id: "getting-started", title: "Getting started", body: "Create an invention, describe it in plain language, and follow the recommended next step shown in its workspace.", action: <Link href="/dashboard?tour=1">Take the dashboard tour</Link> },
  { id: "patent-workflow", title: "How the patent workflow works", body: "Inventra helps you review technical features before searching earlier patents, comparing overlap and preparing a preliminary draft." },
  { id: "grants", title: "How grants matching works", body: "Matches combine your invention profile with applicant details. Always verify current eligibility and deadlines on the official programme portal." },
  { id: "manufacturing", title: "How manufacturing estimates work", body: "Component, cost and supplier suggestions are planning estimates based on the information you provide, not supplier quotations." },
  { id: "trademarks", title: "How trademark screening works", body: "Name screening is preliminary. Confirm the relevant Nice class and verify official registries before relying on a result." },
];

export default function HelpPage() {
  return <DashboardShell><main className="help-page"><header className="page-intro"><p className="eyebrow">HELP CENTRE</p><h1>How can we help?</h1><p>Short, practical guidance for completing your Inventra workflow.</p></header>
    <section className="help-guide-grid" aria-label="Inventra guides">{guides.map((guide) => <article id={guide.id} key={guide.id}><h2>{guide.title}</h2><p>{guide.body}</p>{guide.action}</article>)}</section>
    <section className="help-glossary"><h2>Common terms</h2><dl><div><dt>Prior art</dt><dd>Earlier public patents or documents related to your invention.</dd></div><div><dt>Feature set</dt><dd>The technical parts and functions that define your invention.</dd></div><div><dt>Overlap</dt><dd>How much a searched patent appears to share with your approved features.</dd></div><div><dt>Nice class</dt><dd>A category describing products or services sold under a trademark.</dd></div><div><dt>Prototype</dt><dd>An early working version used to test the idea.</dd></div><div><dt>DPIIT recognition</dt><dd>Startup recognition issued through Startup India.</dd></div></dl></section>
    <section className="help-faq"><h2>Frequently asked questions</h2><details><summary>Does Inventra provide legal advice?</summary><p>No. Patent searches, overlap assessments, trademark screening and generated drafts are preliminary automated outputs that require professional review.</p></details><details><summary>Do I need images to continue?</summary><p>No. Images can improve the technical record, but you may continue to analysis without uploading one.</p></details><details><summary>Will old searches disappear when features change?</summary><p>No. Historical records remain readable and are marked outdated when they use an older feature set.</p></details></section>
    <aside className="help-disclaimer" role="note"><strong>Legal and accuracy disclaimer</strong><p>Inventra does not guarantee patentability, funding eligibility, manufacturing cost, trademark availability or official approval. Verify important decisions with the relevant authority and a qualified professional.</p></aside>
  </main></DashboardShell>;
}
