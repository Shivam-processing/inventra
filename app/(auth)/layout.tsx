import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator } from "@/lib/i18n/translate";

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = createTranslator(await getLocale());
  return <main className="auth-page">
    <div className="auth-topbar"><Link href="/" className="brand"><span>IN</span> Inventra</Link><LanguageSwitcher /></div>
    <section className="auth-shell">
      <div className="auth-context" aria-hidden="true">
        <span>{t("auth.workspace")}</span>
        <h2>{t("auth.contextTitle")}</h2>
        <p>{t("auth.contextDescription")}</p>
        <div><i>✓</i><span><strong>{t("auth.private")}</strong><small>{t("auth.privateDetail")}</small></span></div>
        <div><i>✓</i><span><strong>{t("auth.review")}</strong><small>{t("auth.reviewDetail")}</small></span></div>
      </div>
      {children}
    </section>
    <small className="auth-legal">{t("landing.legal")}</small>
  </main>;
}
