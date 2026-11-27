import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import type { ImageAnalysisResult } from "@/lib/ai/providers/types";
import { toModelImage } from "@/lib/images/modelImage";
import { toDataUri } from "@/lib/orchestration/toDataUri";
import { readComposition } from "@/lib/orchestration/composition";
import type { DesignSchema } from "@/lib/design-schema/types";
import type { Block } from "@/lib/orchestration/blocks/types";
import { SUGGEST_TYPES, suggestBlock, type SuggestType } from "@/lib/copy/suggestBlock";

export const maxDuration = 60;

// Suggestions for one section of a poster, from the editor's "Suggest"
// button. Free: one text call, and it's what turns a thin ad into a full one.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { type?: unknown; blocks?: unknown };
  if (typeof body.type !== "string" || !SUGGEST_TYPES.includes(body.type as SuggestType)) {
    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  }

  // RLS scopes both reads to the signed-in user's own rows.
  const { data: project } = await supabase
    .from("creative_projects")
    .select("id, product_id, design_schema")
    .eq("id", projectId)
    .single();
  if (!project?.product_id) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [{ data: product }, { data: primary }] = await Promise.all([
    supabase.from("products").select("name, category, description, attributes").eq("id", project.product_id).single(),
    supabase
      .from("product_images")
      .select("storage_path, ai_analysis")
      .eq("product_id", project.product_id)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  let image: string | undefined;
  if (primary) {
    const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(primary.storage_path, 300);
    if (signed) image = await toDataUri(signed.signedUrl).then(toModelImage).catch(() => undefined);
  }

  const composition = project.design_schema ? readComposition(project.design_schema as DesignSchema) : null;
  // The editor's live blocks, so suggestions skip what's on the poster right now.
  const blocks = Array.isArray(body.blocks) ? (body.blocks as Block[]).slice(0, 20) : (composition?.blocks ?? []);

  try {
    const suggestions = await suggestBlock({
      type: body.type as SuggestType,
      product,
      analysis: (primary?.ai_analysis ?? null) as ImageAnalysisResult | null,
      image,
      blocks,
      facts: composition?.facts,
    });
    if (suggestions.options.length === 0) throw new Error("No suggestions came back");
    return NextResponse.json(suggestions);
  } catch (err) {
    console.error("Copy suggestions failed:", err);
    return NextResponse.json({ error: "Couldn't write suggestions right now. Try again in a moment." }, { status: 502 });
  }
}
