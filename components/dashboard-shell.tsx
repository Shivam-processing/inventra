"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { logout } from "@/app/auth/actions";

const nav = [
  ["▦", "Overview"], ["◇", "Inventions"], ["⌕", "Patent searches"], ["▤", "Reports"], ["▧", "Drafts"],
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="dashboard-shell">
    <aside className={open ? "dashboard-sidebar open" : "dashboard-sidebar"} id="dashboard-navigation">
      <div className="sidebar-brand"><Link href="/" className="brand"><span>IN</span> Inventra</Link><button type="button" aria-label="Close sidebar" onClick={() => setOpen(false)}>×</button></div>
      <nav aria-label="Dashboard navigation">
        <p>WORKSPACE</p>
        {nav.map(([icon, label], index) => <a className={index === 0 ? "active" : ""} href="#" key={label} onClick={() => setOpen(false)}><span>{icon}</span>{label}{label === "Inventions" && <small>3</small>}</a>)}
      </nav>
      <div className="sidebar-bottom"><a href="#"><span>?</span>Help & resources</a><a href="#"><span>⚙</span>Settings</a><div className="user-chip"><p><strong>Alex Morgan</strong><small>Signed in</small></p><form action={logout}><button type="submit" aria-label="Log out">Log out</button></form></div></div>
    </aside>
    {open && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setOpen(false)} />}
    <div className="dashboard-main">
      <header className="dashboard-topbar"><button type="button" className="sidebar-toggle" aria-controls="dashboard-navigation" aria-expanded={open} aria-label="Open sidebar" onClick={() => setOpen(true)}>☰</button><span className="mobile-brand">Inventra</span><div><button type="button" aria-label="Notifications">♢<i /></button><span className="avatar">AM</span></div></header>
      <main className="dashboard-content">{children}</main>
    </div>
  </div>;
}
