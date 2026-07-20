"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-state error-state" role="alert"><span aria-hidden="true">!</span><div><strong>Unable to load your workspace</strong><p>Please try again.</p><button type="button" onClick={reset}>Try again</button></div></main>;
}
