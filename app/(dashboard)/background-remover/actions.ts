"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/supabase/server";
import { inspectCutoutPng, SegmentError } from "@/lib/background-remover/server";

// Feature 4 — the optional cutout asset library. Self-contained: nothing in
// the other tools reads from or depends on it.

const BUCKET = "product-images";
const MAX_CUTOUT_BYTES = 40 * 1024 * 1024;
const LIBRARY_PATH = "/background-remover/library";

type Result = { error?: string; id?: string };

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Registers a PNG the browser already uploaded to the user's own
 * `<uid>/cutouts/` folder. The file is re-validated here (real PNG, real
 * alpha channel) before it becomes an asset; anything invalid is removed.
 */
export async function saveCutout(input: { path: string; name: string }): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const pattern = new RegExp(`^${user.id}/cutouts/[0-9a-f-]{36}\\.png$`);
  if (!pattern.test(input.path)) return { error: "Invalid file path." };
  const name = cleanName(input.name) || "Untitled cutout";

  const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(input.path);
  if (dlError || !blob) return { error: "The uploaded file wasn't found." };

  const discard = async (error: string): Promise<Result> => {
    await supabase.storage.from(BUCKET).remove([input.path]);
    return { error };
  };

  if (blob.size > MAX_CUTOUT_BYTES) return discard("The PNG is too large to save.");

  let dims: { width: number; height: number };
  try {
    dims = await inspectCutoutPng(Buffer.from(await blob.arrayBuffer()));
  } catch (err) {
    return discard(err instanceof SegmentError ? err.message : "That file isn't a valid PNG.");
  }

  const { data: row, error } = await supabase
    .from("background_cutouts")
    .insert({ user_id: user.id, name, storage_path: input.path, width: dims.width, height: dims.height, bytes: blob.size })
    .select("id")
    .single();
  if (error || !row) return discard("Couldn't save the cutout.");

  revalidatePath(LIBRARY_PATH);
  return { id: row.id };
}

export async function renameCutout(id: string, rawName: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const name = cleanName(rawName);
  if (!name) return { error: "Name can't be empty." };

  const { error } = await supabase.from("background_cutouts").update({ name }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Couldn't rename the cutout." };
  revalidatePath(LIBRARY_PATH);
  return { id };
}

export async function deleteCutout(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: row } = await supabase
    .from("background_cutouts")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { error: "Cutout not found." };

  await supabase.storage.from(BUCKET).remove([row.storage_path]);
  const { error } = await supabase.from("background_cutouts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Couldn't delete the cutout." };
  revalidatePath(LIBRARY_PATH);
  return { id };
}
