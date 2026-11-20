import Link from "next/link";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShotGrid } from "@/components/photoshoot/ShotGrid";

export default async function PhotoshootIndexPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: shots }] = await Promise.all([
    supabase.from("products").select("id, name").order("created_at", { ascending: false }),
    supabase
      .from("photoshoot_images")
      .select("id, scene, storage_path, width, height, product_id, products(name)")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const gallery = (shots ?? []).map((s) => ({
    id: s.id,
    scene: s.scene,
    width: s.width,
    height: s.height,
    productId: s.product_id,
    productName: (s.products as unknown as { name: string } | null)?.name,
    url: supabase.storage.from("generated-images").getPublicUrl(s.storage_path).data.publicUrl,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Photoshoot</h1>
        <p className="text-muted-foreground">Your real product, placed into AI-generated scenes. Pick a product to start.</p>
      </div>
      {!products || products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Add a product first.{" "}
            <Link href="/products/new" className="underline underline-offset-4">
              New product
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {products.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              render={<Link href={`/products/${p.id}/photoshoot`} />}
              nativeButton={false}
              className="gap-1.5"
            >
              <Camera className="size-4" /> {p.name || "Untitled product"}
            </Button>
          ))}
        </div>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent shots</h2>
        <ShotGrid shots={gallery} />
      </section>
    </div>
  );
}
