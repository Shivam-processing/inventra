import Link from "next/link";
import { LandingExperience } from "@/components/landing-experience";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return <div className="site-page lab-page">
    <SiteHeader />
    <LandingExperience />
    <footer className="lab-footer section-shell">
      <Link href="/" className="brand"><span>IN</span> Inventra</Link>
      <p>Intelligence for ideas worth protecting.</p>
      <small>Inventra is not a law firm and does not provide legal advice.</small>
    </footer>
  </div>;
}
