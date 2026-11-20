import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/db/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalysisReviewCard } from "@/components/products/AnalysisReviewCard";
import { CreateCreativeProjectButton } from "./CreateCreativeProjectButton";
import { CampaignLauncher } from "./CampaignLauncher";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdCard } from "@/components/creative/AdCard";
import { AutoRefresh } from "@/components/jobs/AutoRefresh";
import { isWorking, loadProjectCards, splitFailures } from "@/lib/jobs/projectStatus";
import { angleById } from "@/lib/orchestration/angles";
import { FailureNotices } from "@/components/jobs/FailureNotices";

type ImageAnalysis = {
  suggestedCategory: string;
  confidence: number;
  notes?: string;
  productType?: string;
  visibleClaims?: string[];
  materials?: string[];
  detectedText?: string[];
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase.from("products").select("*").eq("id", productId).single();

  if (!product) {
    notFound();
  }

  const { data: images } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false });

  const primaryImage = images?.[0];
  let primaryImageUrl: string | null = null;
  if (primaryImage) {
    const { data: signed } = await supabase.storage
      .from("product-images")
      .createSignedUrl(primaryImage.storage_path, 3600);
    primaryImageUrl = signed?.signedUrl ?? null;
  }

  const [allCards, { count: shotCount }] = await Promise.all([
    loadProjectCards(supabase, { productId }),
    supabase.from("photoshoot_images").select("id", { count: "exact", head: true }).eq("product_id", productId),
  ]);
  const { visible: cards, failures } = splitFailures(allCards, (c) => `${angleById(c.angle)?.label ?? "An"} ad`);
  const anyWorking = cards.some((card) => isWorking(card.status));

  const analysis = primaryImage?.ai_analysis as ImageAnalysis | null;
  const needsReview = primaryImage && !primaryImage.analysis_approved_at;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AutoRefresh active={anyWorking} />
      <FailureNotices failures={failures} noun="ads" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{product.name || "Untitled product"}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{product.category || "Uncategorized"}</Badge>
            {product.category_confirmed && <Badge variant="outline">Confirmed</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href={`/products/${product.id}/photoshoot`} />} nativeButton={false} className="gap-1.5">
            <Camera className="size-4" /> Photoshoot{shotCount ? ` (${shotCount})` : ""}
          </Button>
          <CreateCreativeProjectButton productId={product.id} disabled={!product.category_confirmed} />
        </div>
      </div>

      {needsReview && analysis && (
        <AnalysisReviewCard
          productId={product.id}
          productImageId={primaryImage.id}
          currentCategory={product.category}
          suggestedCategory={analysis.suggestedCategory}
          confidence={primaryImage.ai_analysis_confidence}
        />
      )}

      {cards.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Your ads</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <AdCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      <CampaignLauncher productId={product.id} disabled={!product.category_confirmed} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {primaryImageUrl && (
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {/* Signed Supabase Storage URL, not a static asset — unoptimized avoids Next's image optimizer needing to be allow-listed for this dynamic host. */}
            <Image src={primaryImageUrl} alt={product.name ?? "Product photo"} fill unoptimized className="object-cover" />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>What you entered for this product.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {product.description && <p>{product.description}</p>}
            {product.objective && (
              <p>
                <span className="text-muted-foreground">Objective: </span>
                {product.objective}
              </p>
            )}
            {product.target_platform && (
              <p>
                <span className="text-muted-foreground">Platform: </span>
                {product.target_platform}
              </p>
            )}
            {product.attributes?.price && (
              <p>
                <span className="text-muted-foreground">Price: </span>
                {product.attributes.price}
              </p>
            )}
            {product.attributes?.brandName && (
              <p>
                <span className="text-muted-foreground">Brand: </span>
                {product.attributes.brandName}
              </p>
            )}
            {product.attributes?.offer && (
              <p>
                <span className="text-muted-foreground">Offer: </span>
                {product.attributes.offer}
              </p>
            )}
            {product.attributes?.specs && (
              <div>
                <span className="text-muted-foreground">Specs &amp; features:</span>
                <p className="whitespace-pre-line">{product.attributes.specs}</p>
              </div>
            )}
          </CardContent>
        </Card>
        {analysis && (analysis.visibleClaims?.length || analysis.materials?.length || analysis.productType) ? (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Read from your photo</CardTitle>
              <CardDescription>
                What the AI could see on the product. Printed claims are used as facts in your ads;
                looks and materials guide the art direction.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {analysis.productType && (
                <p>
                  <span className="text-muted-foreground">Looks like: </span>
                  {analysis.productType}
                </p>
              )}
              {[
                { title: "Printed on the product", items: analysis.visibleClaims },
                { title: "Materials & finish", items: analysis.materials },
              ].map(({ title, items }) =>
                items && items.length > 0 ? (
                  <div key={title} className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground">{title}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item) => (
                        <Badge key={item} variant="outline">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
