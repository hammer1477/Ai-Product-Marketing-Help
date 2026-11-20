import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { dispatchJobs } from "@/lib/jobs/dispatch";
import { COPY_ANGLES } from "@/lib/orchestration/angles";

// Starts a campaign pack: one ad per chosen copy angle, generated in
// parallel. Credits for every ad are held up front, all or nothing.
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { angles?: unknown; colorSource?: unknown };
  const colorSource = body.colorSource === "brand" || body.colorSource === "product" ? body.colorSource : null;
  const known = new Set(COPY_ANGLES.map((a) => a.id));
  const angles = Array.isArray(body.angles)
    ? [...new Set(body.angles.filter((a): a is string => typeof a === "string" && known.has(a)))]
    : [];
  if (angles.length < 2 || angles.length > 6) {
    return NextResponse.json({ error: "Pick between 2 and 6 angles." }, { status: 400 });
  }

  const { data: product } = await supabase.from("products").select("category_confirmed").eq("id", productId).single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (!product.category_confirmed) {
    return NextResponse.json({ error: "Confirm the product's category before generating." }, { status: 400 });
  }

  const { data: campaignId, error } = await supabase.rpc("reserve_campaign", {
    p_user_id: user.id,
    p_product_id: productId,
    p_angles: angles,
  });
  if (error || !campaignId) {
    return NextResponse.json({ error: error?.message ?? "Couldn't start the campaign" }, { status: 400 });
  }

  // Before dispatch, so every worker sees the choice.
  if (colorSource) {
    await supabase.from("creative_projects").update({ color_source: colorSource }).eq("campaign_id", campaignId);
  }

  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("id, creative_projects!inner(campaign_id)")
    .eq("creative_projects.campaign_id", campaignId)
    .eq("status", "pending");
  dispatchJobs(new URL(request.url).origin, (jobs ?? []).map((j) => j.id));

  return NextResponse.json({ campaignId });
}
