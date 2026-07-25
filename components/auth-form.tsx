"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/auth/actions";
import { useLanguage } from "@/components/language-provider";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const { t } = useLanguage();
  const [state, formAction, pending] = useActionState(isSignup ? signup : login, initialState);

  return <div className="auth-card">
    <div className="auth-card-heading">
      <span className="auth-kicker">{t(isSignup ? "auth.createKicker" : "auth.welcomeKicker")}</span>
      <h1>{t(isSignup ? "auth.signupTitle" : "auth.loginTitle")}</h1>
      <p>{t(isSignup ? "auth.signupDescription" : "auth.loginDescription")}</p>
    </div>
    <form action={formAction} className="auth-form">
      {isSignup && <label><span>{t("auth.fullName")}</span><input name="fullName" type="text" autoComplete="name" required placeholder="Alex Morgan" /></label>}
      <label><span>{t("auth.email")}</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <label><span>{t("auth.password")}</span><input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} required placeholder="••••••••" />{isSignup && <small>{t("auth.passwordHint")}</small>}</label>
      {isSignup && <label><span>{t("auth.confirmPassword")}</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required placeholder="••••••••" /></label>}
      {state.error && <div className="auth-alert auth-error" role="alert"><span>!</span>{state.error}</div>}
      {state.message && <div className="auth-alert auth-success" role="status"><span>✓</span>{state.message}</div>}
      <button className="auth-submit" type="submit" disabled={pending} aria-disabled={pending}>
        {pending && <span className="auth-spinner" aria-hidden="true" />}
        {pending ? t(isSignup ? "auth.creating" : "auth.signingIn") : t(isSignup ? "auth.create" : "auth.signIn")}
      </button>
    </form>
    <p className="auth-switch">{t(isSignup ? "auth.already" : "auth.new")} <Link href={isSignup ? "/login" : "/signup"}>{t(isSignup ? "auth.signIn" : "auth.create")}</Link></p>
  </div>;
}
