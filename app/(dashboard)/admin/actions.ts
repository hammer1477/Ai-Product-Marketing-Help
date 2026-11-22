"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";
import { getProfile, isRole } from "@/lib/profile/getProfile";
import { FRIEND_GIFT_CREDITS } from "@/lib/credits/pricing";

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

/** The one permanent Master (migration 0023). */
async function masterId(): Promise<string | null> {
  const { data } = await createServiceRoleClient().from("app_master").select("id").maybeSingle();
  return data?.id ?? null;
}

const MAX_ADJUST = 1_000_000_000_000; // 1T per adjustment — well inside JS safe integers.

export async function adjustCredits(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const owner = await requireOwner();
  if (!owner) return { error: "Only the owner can do this." };

  const userId = String(formData.get("userId") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").replace(/[,\s]/g, ""));
  const mode = formData.get("mode") === "remove" ? -1 : 1;

  if (!userId) return { error: "Missing user." };
  const master = await masterId();
  if (userId === master && owner.id !== master) return { error: "The Master's vault is not yours to touch." };
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

  const admin = createServiceRoleClient();
  const master = await masterId();
  if (userId === master) return { error: "The Master is owner forever — no one can change that." };
  if (owner.id !== master) {
    // Only the Master makes or unmakes owners.
    const { data: target } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (role === "owner" || target?.role === "owner") return { error: "Only the Master can grant or remove the owner rank." };
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  // Friends get their gift the first time they're made a friend — never
  // twice, however often their rank changes (the database enforces it).
  let gifted = false;
  if (role === "friend") {
    const { data, error: giftError } = await admin.rpc("grant_friend_gift", { p_user_id: userId, p_amount: FRIEND_GIFT_CREDITS });
    if (giftError) return { error: `Rank changed, but the gift failed: ${giftError.message}` };
    gifted = data === true;
  }

  revalidatePath("/admin", "layout");
  return {
    success:
      role === "friend"
        ? gifted
          ? `Made a friend — ${FRIEND_GIFT_CREDITS.toLocaleString("en-US")} credits gifted.`
          : "Made a friend (their gift was already given before)."
        : "Role updated.",
  };
}
