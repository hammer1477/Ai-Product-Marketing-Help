"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/supabase/server";

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

  const { error } = await supabase
    .from("profiles")
    .update({ username: username || null, display_name: displayName })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique violation on the lower(username) index.
    if (error.code === "23505") return { error: "That username is already taken." };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
