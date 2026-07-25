import Link from "next/link";
import { LandingExperience } from "@/components/landing-experience";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator } from "@/lib/i18n/translate";

export default async function Home() {
  const t = createTranslator(await getLocale());
  return <div className="site-page lab-page">
    <SiteHeader />
    <LandingExperience />
    <footer className="lab-footer section-shell">
      <Link href="/" className="brand"><span>IN</span> Inventra</Link>
      <p>{t("landing.footerTagline")}</p>
      <small>{t("landing.legal")}</small>
    </footer>
  </div>;
}
