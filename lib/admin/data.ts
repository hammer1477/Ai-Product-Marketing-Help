import "server-only";
import { notFound } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";
import { getProfile, isRole, type Profile, type Role } from "@/lib/profile/getProfile";

// Data access for the master console. Everything here uses the service-role
// client, which bypasses row-level security — so every page calls
// requireOwner() first, and anyone else gets a 404.

export async function requireOwner(): Promise<{ id: string; email?: string; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const profile = await getProfile(user.id);
  if (profile.role !== "owner") notFound();
  return { id: user.id, email: user.email, profile };
}

export function admin() {
  return createServiceRoleClient();
}

export type Person = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  displayName: string | null;
  role: Role;
  createdAt: string;
  lastSignIn: string | null;
};

/** Every account, with its profile — the console's who's-who. */
export async function directory(): Promise<Map<string, Person>> {
  const a = admin();
  const [{ data: authData, error }, { data: profiles }] = await Promise.all([
    a.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    a.from("profiles").select("id, username, display_name, role"),
  ]);
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return new Map(
    authData.users.map((u) => {
      const p = byId.get(u.id);
      const email = u.email ?? "(no email)";
      return [
        u.id,
        {
          id: u.id,
          email,
          username: p?.username ?? null,
          displayName: p?.display_name ?? null,
          name: p?.username || p?.display_name || email.split("@")[0],
          role: isRole(p?.role) ? p.role : "user",
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at ?? null,
        } satisfies Person,
      ];
    }),
  );
}

/** Public URL of a file in the public generated-images bucket. */
export function generatedUrl(path: string): string {
  return admin().storage.from("generated-images").getPublicUrl(path).data.publicUrl;
}

/** Signed URLs (1 hour) for private product photos, keyed by product id. */
export async function productPhotos(productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();
  const a = admin();
  const { data: images } = await a
    .from("product_images")
    .select("product_id, storage_path")
    .in("product_id", productIds)
    .eq("is_primary", true);
  if (!images?.length) return new Map();
  const { data: signed } = await a.storage
    .from("product-images")
    .createSignedUrls(images.map((i) => i.storage_path), 3600);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return new Map(images.flatMap((i) => (urlByPath.get(i.storage_path) ? [[i.product_id, urlByPath.get(i.storage_path)!]] : [])));
}

export type AdTile = {
  projectId: string;
  productId: string;
  userId: string;
  angle: string | null;
  campaignId: string | null;
  url: string | null;
  width: number;
  height: number;
  createdAt: string;
};

/** Ads with their newest picture: the saved edit when there is one, else the latest render. */
export async function adTiles(filter: { userId?: string; productId?: string; limit?: number }): Promise<AdTile[]> {
  const a = admin();
  let q = a
    .from("creative_projects")
    .select("id, product_id, user_id, angle, campaign_id, preview_path, preview_width, preview_height, created_at")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 60);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.productId) q = q.eq("product_id", filter.productId);
  const { data: projects } = await q;
  if (!projects?.length) return [];

  const { data: images } = await a
    .from("generated_images")
    .select("creative_project_id, storage_path, width, height, created_at")
    .in("creative_project_id", projects.map((p) => p.id))
    .order("created_at", { ascending: false });
  const latest = new Map<string, { storage_path: string; width: number; height: number }>();
  for (const img of images ?? []) if (!latest.has(img.creative_project_id)) latest.set(img.creative_project_id, img);

  return projects.map((p) => {
    const img = latest.get(p.id);
    const path = p.preview_path ?? img?.storage_path ?? null;
    return {
      projectId: p.id,
      productId: p.product_id,
      userId: p.user_id,
      angle: p.angle,
      campaignId: p.campaign_id,
      url: path ? generatedUrl(path) : null,
      width: p.preview_path ? p.preview_width ?? 1080 : img?.width ?? 1080,
      height: p.preview_path ? p.preview_height ?? 1080 : img?.height ?? 1080,
      createdAt: p.created_at,
    };
  });
}
