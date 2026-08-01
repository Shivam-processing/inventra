"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { logout } from "@/app/auth/actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { DASHBOARD_NAV_GROUPS, dashboardNavItemActive } from "@/lib/navigation/dashboard";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();
  const sidebarRef = useRef<HTMLElement>(null);
  const currentItem = DASHBOARD_NAV_GROUPS.flatMap((group) => group.items).find((item) => dashboardNavItemActive(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function trapDrawerFocus(event: KeyboardEvent<HTMLElement>) {
    if (!open) return;
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key !== "Tab") return;
    const focusable = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled])') ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="dashboard-shell">
    <aside ref={sidebarRef} className={open ? "dashboard-sidebar open" : "dashboard-sidebar"} id="dashboard-navigation" aria-label={t("navigation.main")} onKeyDown={trapDrawerFocus}>
      <div className="sidebar-brand"><Link href="/" className="brand"><span>IN</span> Inventra</Link><button type="button" aria-label={t("navigation.closeSidebar")} onClick={() => setOpen(false)}>×</button></div>
      <nav aria-label={t("navigation.main")}>
        {DASHBOARD_NAV_GROUPS.map((group) => <section className="sidebar-nav-group" key={group.id}>
          <p>{t(group.labelKey).toUpperCase()}</p>
          {group.items.map((item) => <Link className={dashboardNavItemActive(pathname, item.href) ? "active" : undefined} href={item.href} key={item.href} onClick={() => setOpen(false)} title={t(item.descriptionKey)}><span aria-hidden="true">{item.icon}</span><span><strong>{t(item.labelKey)}</strong><small>{t(item.descriptionKey)}</small></span></Link>)}
        </section>)}
      </nav>
      <div className="sidebar-bottom"><div className="user-chip"><span aria-hidden="true">IN</span><p><strong>{t("navigation.account")}</strong><small>{t("navigation.signedIn")}</small></p><Link href="/dashboard/settings" aria-label={t("navigation.settings")}>⚙</Link><form action={logout}><button type="submit" aria-label={t("navigation.logout")}><span aria-hidden="true">↪</span> {t("navigation.logout")}</button></form></div></div>
    </aside>
    {open && <button className="sidebar-scrim" aria-label={t("navigation.closeSidebar")} onClick={() => setOpen(false)} />}
    <div className="dashboard-main">
      <header className="dashboard-topbar"><button type="button" className="sidebar-toggle" aria-controls="dashboard-navigation" aria-expanded={open} aria-label={t("navigation.openSidebar")} onClick={() => setOpen(true)}>☰</button><span className="mobile-brand">Inventra</span><strong className="topbar-title">{currentItem ? t(currentItem.labelKey) : t("navigation.home")}</strong><div><LanguageSwitcher compact /><Link className="topbar-account" href="/dashboard/settings" aria-label={t("navigation.settings")}>IN</Link></div></header>
      <main className="dashboard-content">{children}</main>
    </div>
  </div>;
}
