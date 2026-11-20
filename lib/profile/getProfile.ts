import { createClient } from "@/lib/db/supabase/server";

export type Profile = {
  username: string | null;
  displayName: string | null;
  role: Role;
};

export const ROLES = ["user", "friend", "family", "owner"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Owner and family generate for free; only owners can open the admin portal. */
export function hasUnlimitedCredits(role: Role): boolean {
  return role === "owner" || role === "family";
}

export async function getProfile(userId: string): Promise<Profile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  return {
    username: data?.username ?? null,
    displayName: data?.display_name ?? null,
    role: isRole(data?.role) ? data.role : "user",
  };
}

/** Name to greet the user with: username, then display name, then the part of the email before the @. */
export function greetingName(profile: Profile, email: string | undefined): string {
  return profile.username || profile.displayName || email?.split("@")[0] || "there";
}
