import "server-only";
import { createServiceRoleClient } from "../db/supabase/server";
import { getImageProvider } from "../ai/providers/factory";
import { removeProductBackdrop, trimTransparentEdges } from "../images/cutout";
import { toDataUri } from "../orchestration/toDataUri";
import { formatDef } from "../orchestration/formats";
import { compositeShot } from "./composite";
import { sceneById, scenePrompt } from "./scenes";

export type PhotoshootParams = {
  /** Preset id, or "custom" with `prompt`. */
  scene: string;
  prompt?: string;
  /** Display name for a custom or AI-suggested scene. */
  label?: string;
  format?: string;
};

/** Longest side the scene is generated at; it's then fitted to the output. */
const GENERATE_MAX = 1536;

// One photoshoot shot = one job. Throws on failure; runJob refunds.
export async function runPhotoshootShot(jobId: string): Promise<{ imageId: string }> {
  const supabase = createServiceRoleClient();

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .select("id, user_id, product_id, params")
    .eq("id", jobId)
    .single();
  if (jobError || !job?.product_id) throw new Error(`Photoshoot job not found: ${jobId}`);

  const params = (job.params ?? {}) as PhotoshootParams;
  const preset = sceneById(params.scene);
  const sceneText = preset?.prompt ?? params.prompt?.trim();
  if (!sceneText) throw new Error("Photoshoot shot has no scene");
  const label = preset?.label ?? (params.label?.trim() || params.prompt || "Custom").slice(0, 80);
  const format = formatDef(params.format);

  const { data: primary } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", job.product_id)
    .eq("is_primary", true)
    .single();
  if (!primary) throw new Error("Product has no primary photo");

  const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(primary.storage_path, 300);
  if (!signed) throw new Error("Couldn't read the product photo");
  const original = await toDataUri(signed.signedUrl);

  const scale = GENERATE_MAX / Math.max(format.width, format.height);
  const [sceneResult, product] = await Promise.all([
    getImageProvider().generate({
      prompt: scenePrompt(sceneText),
      mode: "text-to-image",
      width: Math.round(format.width * scale),
      height: Math.round(format.height * scale),
    }),
    (async () => {
      try {
        const cut = await removeProductBackdrop(original);
        if (!cut.cutoutApplied) return { src: original, cutout: false };
        return { src: (await trimTransparentEdges(cut.dataUri)).dataUri, cutout: true };
      } catch {
        return { src: original, cutout: false };
      }
    })(),
  ]);

  const jpeg = await compositeShot({
    scene: await toDataUri(sceneResult.imageUrl),
    product: product.src,
    cutout: product.cutout,
    width: format.width,
    height: format.height,
  });

  const storagePath = `${job.user_id}/photoshoots/${job.id}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(storagePath, jpeg, { contentType: "image/jpeg" });
  if (uploadError) throw new Error(`Failed to upload shot: ${uploadError.message}`);

  const { data: image, error: insertError } = await supabase
    .from("photoshoot_images")
    .insert({
      user_id: job.user_id,
      product_id: job.product_id,
      job_id: job.id,
      scene: label,
      storage_path: storagePath,
      width: format.width,
      height: format.height,
    })
    .select("id")
    .single();
  if (insertError || !image) throw new Error(`Failed to save shot: ${insertError?.message}`);

  return { imageId: image.id };
}
