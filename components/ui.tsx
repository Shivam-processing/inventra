import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "success" | "warning" | "error" | "info" | "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ButtonLink({ className = "", size = "default", variant = "primary", ...props }: ComponentProps<typeof Link> & { size?: "default" | "large"; variant?: "primary" | "secondary" | "ghost" | "destructive" }) {
  return <Link className={`button button-${size} button-${variant} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`card ${className}`} {...props} />;
}

export function TextInput({ label, hint, ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  const id = props.id ?? props.name;
  const hintId = hint && id ? `${id}-hint` : undefined;
  return <label className="field" htmlFor={id}><span>{label}{props.required && <em>Required</em>}</span><input id={id} aria-describedby={hintId} {...props} />{hint && <small id={hintId}>{hint}</small>}</label>;
}

export function LoadingState() {
  return <div className="state-card" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Analyzing your invention</strong><p>Identifying components and key features…</p></div></div>;
}

export function EmptyState({ title = "No inventions yet", description = "Create your first project to begin." }: { title?: string; description?: string }) {
  return <div className="state-card empty-state"><span aria-hidden="true">＋</span><div><strong>{title}</strong><p>{description}</p></div></div>;
}

export function ErrorState({ title = "Something went wrong", description = "Your work is safe. Please try again." }: { title?: string; description?: string }) {
  return <div className="state-card error-state" role="alert"><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{description}</p></div></div>;
}
