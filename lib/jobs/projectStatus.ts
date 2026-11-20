import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectCard = {
  id: string;
  angle: string | null;
  createdAt: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "draft";
  error: string | null;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Creative projects with their newest job's status and newest render — what
 * a grid of ads needs. A project mid-regeneration shows its previous render
 * with a working badge.
 */
export async function loadProjectCards(
  supabase: SupabaseClient,
  filter: { productId?: string; campaignId?: string },
): Promise<ProjectCard[]> {
  let query = supabase
    .from("creative_projects")
    .select("id, angle, created_at, variant_index")
    .order("created_at", { ascending: false });
  if (filter.productId) query = query.eq("product_id", filter.productId);
  if (filter.campaignId) query = query.eq("campaign_id", filter.campaignId).order("variant_index", { ascending: true });
  const { data: projects } = await query;
  if (!projects || projects.length === 0) return [];

  const ids = projects.map((p) => p.id);
  const [{ data: jobs }, { data: images }] = await Promise.all([
    supabase
      .from("generation_jobs")
      .select("creative_project_id, status, error_message, created_at")
      .in("creative_project_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_images")
      .select("creative_project_id, storage_path, width, height, created_at")
      .in("creative_project_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  const latestJob = new Map<string, { status: string; error_message: string | null }>();
  for (const job of jobs ?? []) if (!latestJob.has(job.creative_project_id)) latestJob.set(job.creative_project_id, job);
  const latestImage = new Map<string, { storage_path: string; width: number; height: number }>();
  for (const img of images ?? []) if (!latestImage.has(img.creative_project_id)) latestImage.set(img.creative_project_id, img);

  const sorted = filter.campaignId
    ? [...projects].sort((a, b) => (a.variant_index ?? 0) - (b.variant_index ?? 0))
    : projects;

  return sorted.map((p) => {
    const job = latestJob.get(p.id);
    const img = latestImage.get(p.id);
    return {
      id: p.id,
      angle: p.angle,
      createdAt: p.created_at,
      status: (job?.status as ProjectCard["status"]) ?? "draft",
      error: job?.error_message ?? null,
      imageUrl: img ? supabase.storage.from("generated-images").getPublicUrl(img.storage_path).data.publicUrl : null,
      width: img?.width ?? null,
      height: img?.height ?? null,
    };
  });
}

export function isWorking(status: ProjectCard["status"]): boolean {
  return status === "pending" || status === "processing";
}

/**
 * Splits cards into what to show and what to announce: an ad whose only
 * attempt failed has nothing to show, so it's toasted (credits refunded)
 * instead of taking a tile. A failed regeneration keeps its earlier render.
 */
export function splitFailures(cards: ProjectCard[], labelFor: (card: ProjectCard) => string) {
  const failed = cards.filter((c) => c.status === "failed" && !c.imageUrl);
  return {
    visible: cards.filter((c) => !(c.status === "failed" && !c.imageUrl)),
    failures: failed.map((c) => ({ id: c.id, label: labelFor(c) })),
  };
}
