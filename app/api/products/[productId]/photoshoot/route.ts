import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { dispatchJobs } from "@/lib/jobs/dispatch";
import { AD_FORMATS } from "@/lib/orchestration/formats";
import { sceneById } from "@/lib/photoshoot/scenes";

// Starts a photoshoot: one job per scene, each a separate shot.
export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { scenes?: unknown; custom?: unknown; format?: unknown };
  const format = AD_FORMATS.some((f) => f.id === body.format) ? (body.format as string) : "square";
  const presets = Array.isArray(body.scenes)
    ? [...new Set(body.scenes.filter((s): s is string => typeof s === "string" && Boolean(sceneById(s))))]
    : [];
  const custom = typeof body.custom === "string" ? body.custom.trim().slice(0, 300) : "";

  const shots = [
    ...presets.map((scene) => ({ scene, format })),
    ...(custom ? [{ scene: "custom", prompt: custom, format }] : []),
  ];
  if (shots.length === 0) return NextResponse.json({ error: "Pick at least one scene." }, { status: 400 });
  if (shots.length > 8) return NextResponse.json({ error: "Up to 8 shots at a time." }, { status: 400 });

  const { data: jobIds, error } = await supabase.rpc("reserve_photoshoot", {
    p_user_id: user.id,
    p_product_id: productId,
    p_shots: shots,
  });
  if (error || !jobIds) {
    return NextResponse.json({ error: error?.message ?? "Couldn't start the photoshoot" }, { status: 400 });
  }

  const ids = (jobIds as Array<string | { reserve_photoshoot: string }>).map((row) =>
    typeof row === "string" ? row : row.reserve_photoshoot,
  );
  dispatchJobs(new URL(request.url).origin, ids);
  return NextResponse.json({ jobIds: ids });
}
