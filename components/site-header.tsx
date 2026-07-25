"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { ButtonLink } from "@/components/ui";

export function SiteHeader() {
  const { t } = useLanguage();
  return <header className="site-header">
    <div className="section-shell header-inner">
      <Link href="/" className="brand"><span>IN</span> Inventra</Link>
      <nav className="main-nav desktop-nav" aria-label={t("navigation.main")}>
        <a href="#lab-workflow">{t("navigation.howItWorks")}</a>
        <Link href="/dashboard">{t("navigation.workspace")}</Link>
        <LanguageSwitcher compact />
        <ButtonLink href="/dashboard">{t("navigation.startInvention")} <span aria-hidden="true">→</span></ButtonLink>
      </nav>
      <details className="mobile-menu">
        <summary aria-label={t("navigation.toggle")}><span /><span /><span /></summary>
        <nav className="main-nav" aria-label={t("navigation.mobile")}>
          <a href="#lab-workflow">{t("navigation.howItWorks")}</a>
          <Link href="/dashboard">{t("navigation.workspace")}</Link>
          <LanguageSwitcher />
          <ButtonLink href="/dashboard">{t("navigation.startInvention")} <span aria-hidden="true">→</span></ButtonLink>
        </nav>
      </details>
    </div>
  </header>;
}
