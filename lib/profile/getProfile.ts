import { cache } from "react";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";

export type Gender = "male" | "female";

export type Profile = {
  username: string | null;
  displayName: string | null;
  role: Role;
  gender: Gender | null;
};

export const ROLES = ["user", "friend", "family", "owner"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isGender(value: unknown): value is Gender {
  return value === "male" || value === "female";
}

/** Owner and family generate for free; only owners can open the admin portal. */
export function hasUnlimitedCredits(role: Role): boolean {
  return role === "owner" || role === "family";
}

export async function getProfile(userId: string): Promise<Profile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, role, gender")
    .eq("id", userId)
    .maybeSingle();

  return {
    username: data?.username ?? null,
    displayName: data?.display_name ?? null,
    role: isRole(data?.role) ? data.role : "user",
    gender: isGender(data?.gender) ? data.gender : null,
  };
}

/** Name to greet the user with: username, then display name, then the part of the email before the @. */
export function greetingName(profile: Profile, email: string | undefined): string {
  return profile.username || profile.displayName || email?.split("@")[0] || "there";
}

/** How the owner is addressed: Master and Daddy, or Mistress and Mommy. */
export type Honorific = { title: "Master" | "Mistress"; pet: "Daddy" | "Mommy" };

export function honorificFor(gender: Gender | null): Honorific {
  return gender === "female" ? { title: "Mistress", pet: "Mommy" } : { title: "Master", pet: "Daddy" };
}

/**
 * The owner's honorific, for pages other people see ("Friend of the
 * Mistress"). Profiles are private under RLS, so this reads the owner's
 * row with the service role — only the gender column, nothing else.
 */
export const getMasterHonorific = cache(async (): Promise<Honorific> => {
  const { data } = await createServiceRoleClient().from("profiles").select("gender").eq("role", "owner").limit(1).maybeSingle();
  return honorificFor(isGender(data?.gender) ? data.gender : null);
});
