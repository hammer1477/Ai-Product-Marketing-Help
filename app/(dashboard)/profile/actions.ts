"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type UpdateProfileState = { error?: string; success?: boolean };

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80) || null;

  if (username && !USERNAME_RE.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers or underscores." };
  }

  const update: { username: string | null; display_name: string | null; gender?: "male" | "female" } = {
    username: username || null,
    display_name: displayName,
  };
  // Master or Mistress — only the owner's form sends it.
  const gender = formData.get("gender");
  if (gender === "male" || gender === "female") update.gender = gender;

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    // 23505 = unique violation on the lower(username) index.
    if (error.code === "23505") return { error: "That username is already taken." };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export type ChangePasswordState = { error?: string; success?: boolean };

const MIN_PASSWORD = 6; // Matches sign-up.

/**
 * Changes the signed-in user's password. The current password is checked
 * first, so a session left open on someone else's computer can't be used
 * to lock the owner out of their own account.
 */
export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current) return { error: "Enter your current password." };
  if (next.length < MIN_PASSWORD) return { error: `Your new password needs at least ${MIN_PASSWORD} characters.` };
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (next === current) return { error: "Choose a password different from your current one." };

  // Verify the current password on a throwaway client, so the check can't
  // disturb the session in this browser's cookies.
  const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) return { error: "Your current password isn't right." };
  // End only the throwaway check session. signOut() defaults to "global",
  // which revokes every session the user has — including the one this
  // request is running under, so updateUser below failed with "Auth
  // session missing".
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return { success: true };
}
