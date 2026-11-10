import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/db/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalysisReviewCard } from "@/components/products/AnalysisReviewCard";
import { CreateCreativeProjectButton } from "./CreateCreativeProjectButton";

type ImageAnalysis = {
  suggestedCategory: string;
  confidence: number;
  notes?: string;
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

  const analysis = primaryImage?.ai_analysis as ImageAnalysis | null;
  const needsReview = primaryImage && !primaryImage.analysis_approved_at;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{product.name || "Untitled product"}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{product.category || "Uncategorized"}</Badge>
            {product.category_confirmed && <Badge variant="outline">Confirmed</Badge>}
          </div>
        </div>
        <CreateCreativeProjectButton productId={product.id} disabled={!product.category_confirmed} />
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
