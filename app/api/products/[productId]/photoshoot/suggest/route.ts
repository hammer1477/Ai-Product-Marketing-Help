import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import type { ImageAnalysisResult } from "@/lib/ai/providers/types";
import { toModelImage } from "@/lib/images/modelImage";
import { toDataUri } from "@/lib/orchestration/toDataUri";
import { suggestScenes, type SceneIdea } from "@/lib/photoshoot/suggest";

export const maxDuration = 120;

// Writes six photoshoot scene ideas for this product and keeps them on the
// product. Free: a single text call, and it's what gets people shooting.
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { more?: boolean };

  const { data: product } = await supabase
    .from("products")
    .select("id, name, category, description, attributes, scene_suggestions")
    .eq("id", productId)
    .single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const { data: primary } = await supabase
    .from("product_images")
    .select("storage_path, ai_analysis")
    .eq("product_id", productId)
    .eq("is_primary", true)
    .maybeSingle();

  let image: string | undefined;
  if (primary) {
    const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(primary.storage_path, 300);
    if (signed) image = await toDataUri(signed.signedUrl).then(toModelImage).catch(() => undefined);
  }

  const previous = (product.scene_suggestions as SceneIdea[] | null) ?? [];
  try {
    const ideas = await suggestScenes({
      product,
      analysis: (primary?.ai_analysis ?? null) as ImageAnalysisResult | null,
      image,
      avoid: body.more ? previous.map((s) => s.title) : [],
    });
    if (ideas.length === 0) throw new Error("No ideas came back");

    // "More ideas" puts the new set first and keeps the earlier ones below.
    const saved = body.more ? [...ideas, ...previous].slice(0, 18) : ideas;
    await supabase.from("products").update({ scene_suggestions: saved }).eq("id", productId);
    return NextResponse.json({ ideas: saved });
  } catch (err) {
    console.error("Scene suggestions failed:", err);
    return NextResponse.json({ error: "Couldn't come up with ideas right now. Try again in a moment." }, { status: 502 });
  }
}
