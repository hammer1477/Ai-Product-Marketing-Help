"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/supabase/server";
import { isFontFamily } from "@/lib/design-schema/fontRegistry";
import { isHex } from "@/lib/orchestration/color";
import { processLogo } from "@/lib/brand/processLogo";

export type SaveBrandState = { error?: string; success?: boolean };

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function text(formData: FormData, key: string, max: number): string | null {
  return String(formData.get(key) ?? "").trim().slice(0, max) || null;
}

export async function saveBrandKit(_prev: SaveBrandState, formData: FormData): Promise<SaveBrandState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const useColors = formData.get("useColors") === "on";
  const colors = {
    ink: String(formData.get("ink") ?? ""),
    accent: String(formData.get("accent") ?? ""),
    text: String(formData.get("text") ?? ""),
    muted: String(formData.get("muted") ?? ""),
  };
  if (useColors && !Object.values(colors).every((c) => isHex(c))) {
    return { error: "Colours must be hex values like #1a2b3c." };
  }

  const headlineFont = String(formData.get("headlineFont") ?? "");
  const bodyFont = String(formData.get("bodyFont") ?? "");

  const row: Record<string, unknown> = {
    user_id: user.id,
    brand_name: text(formData, "brandName", 60),
    tagline: text(formData, "tagline", 120),
    voice: text(formData, "voice", 500),
    colors: useColors ? colors : null,
    headline_font: isFontFamily(headlineFont) ? headlineFont : null,
    body_font: isFontFamily(bodyFont) ? bodyFont : null,
    updated_at: new Date().toISOString(),
  };

  const logoPath = `${user.id}/brand/logo.png`;
  const file = formData.get("logo") as File | null;
  if (formData.get("removeLogo") === "on") {
    await supabase.storage.from("product-images").remove([logoPath]);
    Object.assign(row, { logo_path: null, logo_data_uri: null, logo_aspect: null, logo_tone: null });
  } else if (file && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) return { error: "Logo must be under 5 MB." };
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      return { error: "Logo must be a PNG, JPG, WebP or SVG." };
    }
    let logo;
    try {
      logo = await processLogo(Buffer.from(await file.arrayBuffer()));
    } catch {
      return { error: "Couldn't read that logo file. Try a PNG with a transparent background." };
    }
    // The bucket grants insert and delete but not update, so replace = delete + insert.
    await supabase.storage.from("product-images").remove([logoPath]);
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(logoPath, logo.png, { contentType: "image/png" });
    if (uploadError) return { error: `Logo upload failed: ${uploadError.message}` };
    Object.assign(row, { logo_path: logoPath, logo_data_uri: logo.src, logo_aspect: logo.aspect, logo_tone: logo.tone });
  }

  const { error } = await supabase.from("brand_kits").upsert(row, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath("/brand");
  return { success: true };
}
