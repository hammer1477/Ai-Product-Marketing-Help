import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { Button } from "@/components/ui/button";
import { CutoutLibrary, type CutoutAsset } from "@/components/background-remover/CutoutLibrary";

export const metadata = { title: "Cutout library" };

export default async function CutoutLibraryPage() {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("background_cutouts")
    .select("id, name, storage_path, width, height, bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  let assets: CutoutAsset[] = [];
  if (rows && rows.length > 0) {
    const { data: signed } = await supabase.storage.from("product-images").createSignedUrls(
      rows.map((r) => r.storage_path),
      60 * 60,
    );
    const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    assets = rows.map((r) => ({
      id: r.id,
      name: r.name,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
      createdAt: r.created_at,
      url: urlFor.get(r.storage_path) ?? null,
    }));
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cutout library</h1>
          <p className="text-muted-foreground">Transparent product PNGs you&apos;ve saved from the Background Remover.</p>
        </div>
        <Button variant="outline" render={<Link href="/background-remover" />} nativeButton={false}>
          <ArrowLeft /> Remove another background
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">The library couldn&apos;t be loaded right now.</p>
      ) : (
        <CutoutLibrary assets={assets} />
      )}
    </div>
  );
}
