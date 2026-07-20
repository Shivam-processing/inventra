"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/auth/actions";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState(isSignup ? signup : login, initialState);

  return <div className="auth-card">
    <div className="auth-card-heading">
      <span className="auth-kicker">{isSignup ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</span>
      <h1>{isSignup ? "Start with your invention." : "Continue your patent work."}</h1>
      <p>{isSignup ? "Create a secure workspace for your ideas and drafts." : "Sign in to return to your Inventra workspace."}</p>
    </div>
    <form action={formAction} className="auth-form">
      {isSignup && <label><span>Full name</span><input name="fullName" type="text" autoComplete="name" required placeholder="Alex Morgan" /></label>}
      <label><span>Email address</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <label><span>Password</span><input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={isSignup ? 8 : undefined} required placeholder="••••••••" />{isSignup && <small>At least 8 characters</small>}</label>
      {isSignup && <label><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required placeholder="••••••••" /></label>}
      {state.error && <div className="auth-alert auth-error" role="alert"><span>!</span>{state.error}</div>}
      {state.message && <div className="auth-alert auth-success" role="status"><span>✓</span>{state.message}</div>}
      <button className="auth-submit" type="submit" disabled={pending} aria-disabled={pending}>
        {pending && <span className="auth-spinner" aria-hidden="true" />}
        {pending ? (isSignup ? "Creating account…" : "Signing in…") : (isSignup ? "Create account" : "Sign in")}
      </button>
    </form>
    <p className="auth-switch">{isSignup ? "Already have an account?" : "New to Inventra?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
