import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <DashboardShell><main className="settings-page"><header className="page-intro"><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p>Manage your interface language and account preferences.</p></header><section className="settings-card"><div><h2>Website language</h2><p>Changing the language keeps you on the same route.</p></div><LanguageSwitcher /></section></main></DashboardShell>;
}
