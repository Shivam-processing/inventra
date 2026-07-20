import Link from "next/link";
import { ButtonLink } from "@/components/ui";

export function SiteHeader() {
  return <header className="site-header">
    <div className="section-shell header-inner">
      <Link href="/" className="brand"><span>IN</span> Inventra</Link>
      <nav className="main-nav desktop-nav" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <Link href="/dashboard">Workspace</Link>
        <ButtonLink href="/dashboard">Start an invention <span aria-hidden="true">→</span></ButtonLink>
      </nav>
      <details className="mobile-menu">
        <summary aria-label="Toggle navigation"><span /><span /><span /></summary>
        <nav className="main-nav" aria-label="Mobile navigation">
          <a href="#how-it-works">How it works</a>
          <Link href="/dashboard">Workspace</Link>
          <ButtonLink href="/dashboard">Start an invention <span aria-hidden="true">→</span></ButtonLink>
        </nav>
      </details>
    </div>
  </header>;
}
