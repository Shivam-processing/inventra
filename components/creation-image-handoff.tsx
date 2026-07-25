"use client";

import Link from "next/link";

export function CreationImageHandoff({ inventionId }: { inventionId: string }) {
  function chooseImages() {
    document.querySelector<HTMLInputElement>("#invention-images")?.click();
  }

  return <section className="creation-image-handoff" role="status">
    <div><span aria-hidden="true">✓</span><p><strong>Invention details saved.</strong> Add sketches, prototype photos, or technical diagrams.</p></div>
    <div><button type="button" onClick={chooseImages}>Upload images</button><Link href={`/dashboard/inventions/${inventionId}?section=analysis`}>Skip for now and continue to analysis</Link></div>
  </section>;
}
