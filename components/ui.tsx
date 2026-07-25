import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" | "success" | "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ButtonLink({ className = "", size = "default", ...props }: ComponentProps<typeof Link> & { size?: "default" | "large" }) {
  return <Link className={`button button-${size} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`card ${className}`} {...props} />;
}

export function TextInput({ label, hint, ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  const id = props.id ?? props.name;
  return <label className="field" htmlFor={id}><span>{label}</span><input id={id} {...props} />{hint && <small>{hint}</small>}</label>;
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
