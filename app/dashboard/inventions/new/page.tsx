import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventionForm } from "@/components/invention-form";

export const metadata: Metadata = { title: "New invention" };

export default function NewInventionPage() {
  return <DashboardShell>
    <div className="new-invention-heading">
      <Link href="/dashboard" aria-label="Back to dashboard">←</Link>
      <div><p className="eyebrow">NEW INVENTION</p><h1>Tell us what you’re building.</h1><p>Save the technical foundation, then add supporting images or continue to analysis.</p></div>
    </div>
    <ol className="creation-progress" aria-label="Invention creation progress">
      <li aria-current="step"><span>1</span><strong>Invention details</strong></li>
      <li><span>2</span><strong>Images and sketches</strong></li>
      <li><span>3</span><strong>Technical analysis</strong></li>
    </ol>
    <InventionForm />
  </DashboardShell>;
}
