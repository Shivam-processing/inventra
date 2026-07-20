import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { InventionImages, type InventionImage } from "@/components/invention-images";
import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "invention-images";

type Invention = {
  id: string;
  title: string;
  problem_statement: string;
  invention_description: string;
  development_stage: string;
  publicly_disclosed: boolean;
  previously_sold: boolean;
  previously_filed: boolean;
};

type ImageRow = Omit<InventionImage, "signedUrl"> & {
  storage_path: string;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

export const metadata: Metadata = { title: "Invention details" };

export default async function InventionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: inventionData, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,publicly_disclosed,previously_sold,previously_filed")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !inventionData) notFound();
  const invention = inventionData as Invention;

  const { data: imageData, error: imageError } = await supabase
    .from("invention_images")
    .select("id,storage_path,original_name,image_type,file_size")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .order("id", { ascending: false });

  const rows = (imageData ?? []) as ImageRow[];
  let images: InventionImage[] = [];
  let imagesError = imageError ? "Images could not be loaded." : undefined;

  if (!imageError && rows.length) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(rows.map((image) => image.storage_path), 3600);

    if (!signedError && signedData) {
      const urls = new Map(signedData.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
      images = rows.flatMap(({ storage_path, ...image }) => {
        const signedUrl = urls.get(storage_path);
        return signedUrl ? [{ ...image, signedUrl }] : [];
      });
      if (images.length !== rows.length) imagesError = "Some images could not be loaded.";
    } else {
      imagesError = "Signed image links could not be created.";
    }
  }

  return <DashboardShell>
    <div className="invention-detail-heading">
      <Link href="/dashboard" aria-label="Back to dashboard">←</Link>
      <div><p className="eyebrow">PRIVATE INVENTION</p><h1>{invention.title}</h1><Badge tone={invention.development_stage === "concept" ? "neutral" : "success"}>{formatLabel(invention.development_stage)}</Badge></div>
    </div>

    <div className="invention-detail-grid">
      <Card className="invention-copy"><span>PROBLEM STATEMENT</span><p>{invention.problem_statement}</p></Card>
      <Card className="invention-copy"><span>INVENTION DESCRIPTION</span><p>{invention.invention_description}</p></Card>
      <Card className="prior-activity"><span>PREVIOUS ACTIVITY</span><dl><div><dt>Publicly disclosed</dt><dd>{invention.publicly_disclosed ? "Yes" : "No"}</dd></div><div><dt>Previously sold</dt><dd>{invention.previously_sold ? "Yes" : "No"}</dd></div><div><dt>Previously filed</dt><dd>{invention.previously_filed ? "Yes" : "No"}</dd></div></dl></Card>
    </div>

    {imagesError && <div className="image-action-error detail-image-error" role="alert">{imagesError}</div>}
    {!imageError && <InventionImages inventionId={invention.id} images={images} />}
  </DashboardShell>;
}
