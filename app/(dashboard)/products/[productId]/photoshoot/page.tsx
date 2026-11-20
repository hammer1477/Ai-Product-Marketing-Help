import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { formatForPlatform } from "@/lib/orchestration/formats";
import { sceneById } from "@/lib/photoshoot/scenes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/jobs/AutoRefresh";
import { FailureNotices } from "@/components/jobs/FailureNotices";
import { ShotGrid, type PendingShot } from "@/components/photoshoot/ShotGrid";
import { PhotoshootStudio } from "./PhotoshootStudio";

// Failures stay visible for a while so a refunded shot doesn't just vanish.
function recentFailureCutoff(): string {
  return new Date(Date.now() - 15 * 60 * 1000).toISOString();
}

export default async function ProductPhotoshootPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase.from("products").select("id, name, target_platform").eq("id", productId).single();
  if (!product) notFound();

  const since = recentFailureCutoff();
  const [{ data: shots }, { data: jobs }] = await Promise.all([
    supabase
      .from("photoshoot_images")
      .select("id, scene, storage_path, width, height")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    supabase
      .from("generation_jobs")
      .select("id, status, error_message, params, created_at")
      .eq("product_id", productId)
      .eq("kind", "photoshoot")
      .in("status", ["pending", "processing", "failed"])
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);

  const pending: PendingShot[] = (jobs ?? []).map((job) => {
    const p = (job.params ?? {}) as { scene?: string; prompt?: string };
    return {
      id: job.id,
      status: job.status,
      error: job.error_message,
      scene: sceneById(p.scene)?.label ?? p.prompt?.slice(0, 40) ?? "Custom",
    };
  });
  const gallery = (shots ?? []).map((s) => ({
    id: s.id,
    scene: s.scene,
    width: s.width,
    height: s.height,
    url: supabase.storage.from("generated-images").getPublicUrl(s.storage_path).data.publicUrl,
  }));
  // Failed shots don't get a tile — they're announced once as a toast.
  const failures = pending.filter((p) => p.status === "failed").map((p) => ({ id: p.id, label: p.scene }));
  const inFlight = pending.filter((p) => p.status !== "failed");
  const working = inFlight.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={working} />
      <FailureNotices failures={failures} />
      <div>
        <Link href={`/products/${product.id}`} className="text-sm text-muted-foreground underline underline-offset-4">
          &larr; {product.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Photoshoot</h1>
        <p className="text-muted-foreground">
          Lifestyle product photos for your store, socials and listings. Pick scenes and your product is placed in each.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New shots</CardTitle>
          <CardDescription>Each shot generates separately, about a minute each.</CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoshootStudio productId={product.id} defaultFormat={formatForPlatform(product.target_platform)} />
        </CardContent>
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Shots</h2>
        <ShotGrid shots={gallery} pending={inFlight} />
      </section>
    </div>
  );
}
