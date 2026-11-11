import { createServiceRoleClient } from "../db/supabase/server";
import { renderSchemaToPng } from "../design-schema/render/renderPng";
import { hasBlockingErrors, validateDesignSchema } from "../design-schema/validate";
import { getImageProvider, getTextProvider } from "../ai/providers/factory";
import { composeDesignSchema } from "./composeDesignSchema";
import { decideConcept } from "./decideConcept";
import { decideStyle, resolveStyle } from "./styles";
import { removeProductBackdrop, trimTransparentEdges } from "../images/cutout";
import { toDataUri } from "./toDataUri";
import {
  CREATIVE_CONTENT_SCHEMA,
  LAYOUT_VARIANTS,
  type CreativeBrief,
  type CreativeContent,
  type LayoutVariant,
} from "./types";

const EXPORT_SCALE = 2;

/**
 * Resolution the background scene is generated at.
 *
 * The canvas is 1080 but exports at EXPORT_SCALE, so a scene generated at
 * canvas size gets upscaled 2x on the way out — which is most of why the
 * finished poster looked soft next to its crisp text. Generating above
 * canvas size costs a few seconds and removes that upscale almost
 * entirely. Not the full 2160: the returns flatten well before there, and
 * generation time doesn't.
 */
const BACKGROUND_RESOLUTION = 1536;

// The single entrypoint sequencing generation, mapped to spec section 7's
// step list (Phase-1-relevant subset): ingest -> merge into a brief ->
// decide concept/density -> generate structured copy -> generate/edit
// imagery -> compose the Design Schema -> validate -> render -> persist.
// Credit finalize/refund is the caller's responsibility (lib/jobs/runJob.ts)
// — this function either succeeds and returns the generated_images id, or
// throws.
export async function runCreativeGeneration(jobId: string): Promise<{ generatedImageId: string }> {
  const supabase = createServiceRoleClient();

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .select("id, creative_project_id, user_id")
    .eq("id", jobId)
    .single();
  if (jobError || !job) throw new Error(`Job not found: ${jobId}`);

  const { data: project, error: projectError } = await supabase
    .from("creative_projects")
    .select("id, product_id")
    .eq("id", job.creative_project_id)
    .single();
  if (projectError || !project) throw new Error(`Creative project not found: ${job.creative_project_id}`);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", project.product_id)
    .single();
  if (productError || !product) throw new Error(`Product not found: ${project.product_id}`);

  if (!product.category_confirmed) {
    throw new Error("Product category has not been confirmed — cannot generate creative.");
  }

  const { data: primaryImage, error: imageError } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", product.id)
    .eq("is_primary", true)
    .single();
  if (imageError || !primaryImage) throw new Error(`No primary product image for product: ${product.id}`);

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from("product-images")
    .createSignedUrl(primaryImage.storage_path, 300);
  if (signError || !signedUrlData) throw new Error(`Failed to sign product image URL: ${signError?.message}`);

  const brief: CreativeBrief = {
    productId: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    objective: product.objective,
    targetPlatform: product.target_platform,
    attributes: product.attributes ?? {},
    primaryImageUrl: signedUrlData.signedUrl,
  };

  const decision = decideConcept(brief);
  const preset = decideStyle(brief.category);

  // What this project has already produced. Regenerating is a request for
  // a different ad, not a retry of the same one, so previous directions are
  // fed back in as things to avoid — and enforced in code afterwards,
  // since a prompt is a request and this needs to be a guarantee.
  const history = await readProjectHistory(supabase, project.id);

  // One call produces both the copy and the art direction. Asking the model
  // to art-direct *this* product — its own scene, palette and arrangement —
  // is what stops every product in a category from coming out looking like
  // the same template with the words swapped.
  const textProvider = getTextProvider();
  const contentPromise = textProvider.generateJSON<CreativeContent>({
    system:
      "You are a senior advertising creative director and copywriter at a top agency. " +
      "Write persuasive, truthful ad copy using ONLY the verified product information provided. " +
      "Never invent specifications, certifications, prices, or claims not present in the input. " +
      "Work in three steps. " +
      "STEP 1 - EXTRACT. Read the description and attributes and list every concrete fact they " +
      "contain. Facts are usually buried in prose rather than handed to you as fields: " +
      "'golden metal frames with black CR-39 lenses and full UV protection coating' is four " +
      "facts (frame material, lens material, lens colour, UV protection), not one sentence. " +
      "Look for materials, dimensions, capacities, durations, quantities, compatibility, " +
      "certifications, what's included, care instructions, and what makes it limited or special. " +
      "Do not skip a fact because it was phrased casually. " +
      "STEP 2 - COMPOSE the poster from content blocks, and put those extracted facts on it. " +
      "Rephrase each into poster language: 'Lens' / 'CR-39 polymer' in a specGrid, or " +
      "'Full UV protection' in a featureList. Headline figures go in a statRow and a stated " +
      "price in a priceBlock. Aim to show at least six separate facts; a poster carrying eight " +
      "real facts outsells one carrying three vague adjectives, and a nearly empty poster is a " +
      "failure even if every word on it is true. You still must not invent anything the input " +
      "does not support — extract harder instead. " +
      "STEP 3 - ART-DIRECT it: choose the scene the product belongs in, a palette drawn from " +
      "its own materials and market, and the arrangement that flatters it. Two different " +
      "products must never receive the same composition or art direction. Keep every string " +
      "short enough to read on a poster at a glance — long text is truncated.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          name: brief.name,
          category: brief.category,
          description: brief.description,
          objective: brief.objective,
          targetPlatform: brief.targetPlatform,
          attributes: brief.attributes,
        }),
      },
      ...(history.layouts.length > 0
        ? [
            {
              role: "user" as const,
              content:
                `This product has already been advertised ${history.layouts.length} time(s). ` +
                `Previous arrangements: ${history.layouts.join(", ")}. ` +
                `Previous moods: ${history.moods.join(", ") || "unknown"}. ` +
                "Produce a genuinely different ad this time: a different arrangement, a " +
                "different palette, a different scene, and a different angle on the copy. " +
                "Do not repeat any of the above.",
            },
          ]
        : []),
      {
        // Structured output is close to deterministic for identical input,
        // so without something that actually differs between runs the model
        // returns the same composition every time.
        role: "user" as const,
        content: `Creative variation token (explore a fresh direction): ${Math.random()
          .toString(36)
          .slice(2, 10)}`,
      },
    ],
    schema: CREATIVE_CONTENT_SCHEMA,
  });

  // The real uploaded photo is always what ends up in the design — product
  // identity must never depend on an AI model's ability to preserve it.
  // AI image generation is used only for the background scene, and only as
  // text-to-image with no reference, since that's the one thing it can't
  // get wrong. The cutout step is pure image processing (no model), so it
  // can't alter the product either — it only deletes the studio sweep
  // around it so the product can sit inside the scene.
  const productAssetsPromise = toDataUri(brief.primaryImageUrl).then(async (original) => {
    try {
      const cutout = await removeProductBackdrop(original);
      if (!cutout.cutoutApplied) {
        return {
          original,
          cutout: original,
          cutoutApplied: false,
          aspectRatio: cutout.width / cutout.height,
        };
      }
      const trimmed = await trimTransparentEdges(cutout.dataUri);
      return {
        original,
        cutout: trimmed.dataUri,
        cutoutApplied: true,
        aspectRatio: trimmed.width / trimmed.height,
      };
    } catch (err) {
      // A failed cutout must never fail the job — fall back to the photo
      // as uploaded and let the template frame it on a card instead.
      console.error("Product backdrop removal failed, using original photo:", err);
      return { original, cutout: original, cutoutApplied: false, aspectRatio: 1 };
    }
  });

  const [{ data: content }, productAssets] = await Promise.all([contentPromise, productAssetsPromise]);

  const style = resolveStyle(preset, content.artDirection, history.layouts);

  // Background generation has to wait for the art direction, since the
  // whole point is that the scene is written for this product.
  const wantsBackground = decision.concept === "graphic_poster" || decision.concept === "infographic";
  const backgroundImageUrl = wantsBackground
    ? await getImageProvider()
        .generate({
          prompt: style.backgroundPrompt,
          mode: "text-to-image",
          width: BACKGROUND_RESOLUTION,
          height: BACKGROUND_RESOLUTION,
        })
        .then((r) => toDataUri(r.imageUrl))
        .catch((err) => {
          // Background generation is decorative, not essential — fall
          // back to the flat style color rather than fail the whole job.
          console.error("Background image generation failed, falling back to flat color:", err);
          return undefined;
        })
    : undefined;

  const schema = composeDesignSchema({
    content,
    productImageUrl: productAssets.original,
    productCutoutUrl: productAssets.cutout,
    cutoutApplied: productAssets.cutoutApplied,
    productAspectRatio: productAssets.aspectRatio,
    decision,
    style,
    backgroundImageUrl,
  });

  const issues = validateDesignSchema(schema);
  if (hasBlockingErrors(issues)) {
    throw new Error(`Design validation failed: ${issues.map((i) => i.message).join("; ")}`);
  }

  const png = await renderSchemaToPng(schema, { scale: EXPORT_SCALE });
  const storagePath = `${project.id}/${jobId}.png`;

  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(storagePath, png, { contentType: "image/png" });
  if (uploadError) throw new Error(`Failed to upload rendered PNG: ${uploadError.message}`);

  const { data: generatedImage, error: insertError } = await supabase
    .from("generated_images")
    .insert({
      creative_project_id: project.id,
      job_id: jobId,
      storage_path: storagePath,
      design_schema: schema,
      width: schema.canvas.width * EXPORT_SCALE,
      height: schema.canvas.height * EXPORT_SCALE,
    })
    .select("id")
    .single();
  if (insertError || !generatedImage) throw new Error(`Failed to save generated image: ${insertError?.message}`);

  await supabase
    .from("creative_projects")
    .update({ concept: decision.concept, density: decision.density, design_schema: schema })
    .eq("id", project.id);

  return { generatedImageId: generatedImage.id };
}

type ProjectHistory = { layouts: LayoutVariant[]; moods: string[] };

/**
 * Reads back the arrangements and moods this project has already produced.
 *
 * They're recovered from each generation's stored design schema rather than
 * from a dedicated column: `meta.templateKey` already records the layout,
 * and `meta.composition.style.moodLabel` the direction, so no migration is
 * needed to know what a regeneration should avoid.
 */
async function readProjectHistory(
  supabase: ReturnType<typeof createServiceRoleClient>,
  creativeProjectId: string,
): Promise<ProjectHistory> {
  const { data, error } = await supabase
    .from("generated_images")
    .select("design_schema")
    .eq("creative_project_id", creativeProjectId)
    .order("created_at", { ascending: false })
    .limit(4);

  // History only improves variety — never fail a generation over it.
  if (error || !data) return { layouts: [], moods: [] };

  const layouts = new Set<LayoutVariant>();
  const moods = new Set<string>();

  for (const row of data) {
    const meta = (row.design_schema as { meta?: Record<string, unknown> } | null)?.meta;
    if (!meta) continue;

    const templateKey = typeof meta.templateKey === "string" ? meta.templateKey : "";
    const layout = templateKey.split("-")[1] as LayoutVariant | undefined;
    if (layout && LAYOUT_VARIANTS.includes(layout)) layouts.add(layout);

    const composition = meta.composition as { style?: { moodLabel?: unknown } } | undefined;
    const mood = composition?.style?.moodLabel;
    if (typeof mood === "string" && mood) moods.add(mood);
  }

  return { layouts: [...layouts], moods: [...moods] };
}
