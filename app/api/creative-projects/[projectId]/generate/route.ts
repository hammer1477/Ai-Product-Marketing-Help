import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { GENERATION_COST_CREDITS } from "@/lib/credits/pricing";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS scopes this to the caller's own project; a project belonging to
  // another user simply won't be found.
  const { data: project, error: projectError } = await supabase
    .from("creative_projects")
    .select("id, product_id")
    .eq("id", projectId)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: "Creative project not found" }, { status: 404 });
  }

  const { data: product } = await supabase
    .from("products")
    .select("category_confirmed")
    .eq("id", project.product_id)
    .single();
  if (!product?.category_confirmed) {
    return NextResponse.json(
      { error: "Confirm the product's category before generating a creative." },
      { status: 400 },
    );
  }

  // p_user_id comes from the authenticated session, never the request body
  // — reserve_credits must never trust a client-supplied user id.
  // Cast is required because the Supabase client isn't generated against a
  // Database type, so custom RPC return shapes aren't inferred.
  const { data: job, error: reserveError } = (await supabase
    .rpc("reserve_credits", {
      p_user_id: user.id,
      p_amount: GENERATION_COST_CREDITS,
      p_creative_project_id: projectId,
    })
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (reserveError || !job) {
    return NextResponse.json({ error: reserveError?.message ?? "Failed to reserve credits" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  // Fire-and-forget: kick off the worker immediately but don't make the
  // client wait on it. `after()` keeps the function alive long enough to
  // dispatch the request even after the response below is sent. The cron
  // sweep in /api/jobs/poll catches this job if this call is ever dropped.
  after(() => {
    fetch(`${origin}/api/jobs/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((err) => console.error("Failed to dispatch job worker:", err));
  });

  return NextResponse.json({ jobId: job.id });
}
