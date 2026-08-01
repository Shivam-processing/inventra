"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "@/app/auth/actions";
import { useLanguage } from "@/components/language-provider";

const initialState: AuthState = {};

function PasswordField({ name, label, autoComplete, show, setShow, hint }: { name: string; label: string; autoComplete: string; show: boolean; setShow: (show: boolean) => void; hint?: string }) {
  const { t } = useLanguage();
  return <label><span>{label}</span><span className="password-field"><input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} minLength={name === "password" && autoComplete === "current-password" ? undefined : 8} required placeholder="••••••••" aria-describedby={hint ? `${name}-hint` : undefined} /><button type="button" onClick={() => setShow(!show)} aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")} aria-pressed={show}>{t(show ? "auth.hide" : "auth.show")}</button></span>{hint && <small id={`${name}-hint`}>{hint}</small>}</label>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [state, formAction, pending] = useActionState(isSignup ? signup : login, initialState);

  return <div className="auth-card">
    <nav className="auth-tabs" aria-label="Authentication"><Link aria-current={!isSignup ? "page" : undefined} href="/login">{t("auth.loginTab")}</Link><Link aria-current={isSignup ? "page" : undefined} href="/signup">{t("auth.signupTab")}</Link></nav>
    <div className="auth-card-heading">
      <span className="auth-kicker">{t(isSignup ? "auth.createKicker" : "auth.welcomeKicker")}</span>
      <h1>{t(isSignup ? "auth.signupTitle" : "auth.loginTitle")}</h1>
      <p>{t(isSignup ? "auth.signupDescription" : "auth.loginDescription")}</p>
    </div>
    <form action={formAction} className="auth-form">
      {isSignup && <label><span>{t("auth.fullName")}</span><input name="fullName" type="text" autoComplete="name" required placeholder="Alex Morgan" /></label>}
      <label><span>{t("auth.email")}</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <PasswordField name="password" label={t("auth.password")} autoComplete={isSignup ? "new-password" : "current-password"} show={showPassword} setShow={setShowPassword} hint={isSignup ? t("auth.passwordRequirements") : undefined} />
      {isSignup && <PasswordField name="confirmPassword" label={t("auth.confirmPassword")} autoComplete="new-password" show={showConfirmation} setShow={setShowConfirmation} />}
      {state.error && <div className="auth-alert auth-error" role="alert"><span>!</span>{state.error}</div>}
      {state.message && <div className="auth-alert auth-success auth-confirmation-message" role="status"><span>✓</span>{state.message}</div>}
      <button className="auth-submit" type="submit" disabled={pending} aria-disabled={pending}>
        {pending && <span className="auth-spinner" aria-hidden="true" />}
        {pending ? t(isSignup ? "auth.creating" : "auth.signingIn") : t(isSignup ? "auth.create" : "auth.signIn")}
      </button>
    </form>
    <p className="auth-switch">{t(isSignup ? "auth.already" : "auth.new")} <Link href={isSignup ? "/login" : "/signup"}>{t(isSignup ? "auth.signIn" : "auth.create")}</Link></p>
  </div>;
}
