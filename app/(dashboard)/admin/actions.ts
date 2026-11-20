"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";
import { getProfile, isRole } from "@/lib/profile/getProfile";

export type AdminActionState = { error?: string; success?: string };

// Every admin action re-checks the caller server-side. The service-role client
// below bypasses RLS, so this check is the only thing guarding it.
async function requireOwner(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  return profile.role === "owner" ? { id: user.id } : null;
}

const MAX_ADJUST = 1_000_000_000_000; // 1T per adjustment — well inside JS safe integers.

export async function adjustCredits(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (!(await requireOwner())) return { error: "Only the owner can do this." };

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").replace(/[,\s]/g, ""));
  const mode = formData.get("mode") === "remove" ? -1 : 1;

  if (!userId) return { error: "Missing user." };
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Enter a whole number above 0." };
  if (amount > MAX_ADJUST) return { error: "Max 1,000,000,000,000 per adjustment." };

  const { data, error } = await createServiceRoleClient().rpc("admin_adjust_credits", {
    p_user_id: userId,
    p_amount: amount * mode,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin", "layout");
  return { success: `Balance is now ${Number(data).toLocaleString("en-US")}.` };
}

export async function setRole(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const owner = await requireOwner();
  if (!owner) return { error: "Only the owner can do this." };

  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role");

  if (!userId || !isRole(role)) return { error: "Invalid role." };
  if (userId === owner.id && role !== "owner") {
    return { error: "You can't remove your own owner role — you'd lock yourself out." };
  }

  const { error } = await createServiceRoleClient().from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin", "layout");
  return { success: "Role updated." };
}
