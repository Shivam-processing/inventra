"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/app/auth/actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { DASHBOARD_NAV_ITEMS, dashboardNavItemActive } from "@/lib/navigation/dashboard";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();
  return <div className="dashboard-shell">
    <aside className={open ? "dashboard-sidebar open" : "dashboard-sidebar"} id="dashboard-navigation">
      <div className="sidebar-brand"><Link href="/" className="brand"><span>IN</span> Inventra</Link><button type="button" aria-label={t("navigation.closeSidebar")} onClick={() => setOpen(false)}>×</button></div>
      <nav aria-label={t("navigation.main")}>
        <p>{t("navigation.workspace").toUpperCase()}</p>
        {DASHBOARD_NAV_ITEMS.map((item) => <Link className={dashboardNavItemActive(pathname, item.href) ? "active" : undefined} href={item.href} key={item.href} onClick={() => setOpen(false)}><span>{item.icon}</span>{t(item.labelKey)}</Link>)}
      </nav>
      <div className="sidebar-bottom"><div className="user-chip"><p><strong>Inventra</strong><small>{t("navigation.signedIn")}</small></p><form action={logout}><button type="submit" aria-label={t("navigation.logout")}>{t("navigation.logout")}</button></form></div></div>
    </aside>
    {open && <button className="sidebar-scrim" aria-label={t("navigation.closeSidebar")} onClick={() => setOpen(false)} />}
    <div className="dashboard-main">
      <header className="dashboard-topbar"><button type="button" className="sidebar-toggle" aria-controls="dashboard-navigation" aria-expanded={open} aria-label={t("navigation.openSidebar")} onClick={() => setOpen(true)}>☰</button><span className="mobile-brand">Inventra</span><div><LanguageSwitcher compact /></div></header>
      <main className="dashboard-content">{children}</main>
    </div>
  </div>;
}
