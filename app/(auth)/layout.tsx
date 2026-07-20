import Link from "next/link";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main className="auth-page">
    <Link href="/" className="brand"><span>IN</span> Inventra</Link>
    <section className="auth-shell">
      <div className="auth-context" aria-hidden="true">
        <span>YOUR WORKSPACE</span>
        <h2>Build a stronger patent story, one clear step at a time.</h2>
        <p>Review every feature, resolve uncertainty, and keep control of your draft.</p>
        <div><i>✓</i><span><strong>Private workspace</strong><small>Your ideas stay tied to your account.</small></span></div>
        <div><i>✓</i><span><strong>Review at every stage</strong><small>Nothing moves forward without you.</small></span></div>
      </div>
      {children}
    </section>
    <small className="auth-legal">Inventra is not a law firm and does not provide legal advice.</small>
  </main>;
}
