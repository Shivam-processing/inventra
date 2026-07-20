import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventionForm } from "@/components/invention-form";

export const metadata: Metadata = { title: "New invention" };

export default function NewInventionPage() {
  return <DashboardShell>
    <div className="new-invention-heading">
      <Link href="/dashboard" aria-label="Back to dashboard">←</Link>
      <div><p className="eyebrow">NEW INVENTION</p><h1>Tell us what you’re building.</h1><p>Capture the foundation now. Images and deeper analysis come later.</p></div>
    </div>
    <InventionForm />
  </DashboardShell>;
}
