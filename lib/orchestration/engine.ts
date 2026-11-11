import { createServiceRoleClient } from "../db/supabase/server";
import { renderSchemaToPng } from "../design-schema/render/renderPng";
import { hasBlockingErrors, validateDesignSchema } from "../design-schema/validate";
import { getImageProvider, getTextProvider } from "../ai/providers/factory";
import { composeDesignSchema } from "./composeDesignSchema";
import { decideConcept } from "./decideConcept";
import { decideStyle, resolveStyle } from "./styles";
import { removeProductBackdrop, trimTransparentEdges } from "../images/cutout";
import { toDataUri } from "./toDataUri";
import { getTemplate } from "./templates/registry";
import type { CreativeBrief } from "./types";
import type { ImageAnalysisResult } from "../ai/providers/types";
import type { ResolvedStyle } from "./styles";
import { normalizeFactSheet, type FactSheet } from "./factSheet";
import { normalizeDesignBrief } from "./designBrief";
import { generateCreative } from "./creative";
import { toModelImage } from "../images/modelImage";

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
    .select("id, product_id, design_schema")
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
    .select("storage_path, ai_analysis")
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
  // What the vision model read off the photo at upload. It used to be
  // stored and never read again — printed claims like "SPF 50" or
  // "Bluetooth 5.3" never reached the copywriter.
  const analysis = (primaryImage.ai_analysis ?? null) as ImageAnalysisResult | null;

  const decision = decideConcept(brief);
  const preset = decideStyle(brief.category);

  // What this project has already produced. Regenerating is a request for
  // a different ad, not a retry of the same one. The design itself is
  // chosen in code from templates this project hasn't used recently — a
  // guarantee — and previous moods are fed to the model so the palette,
  // scene and copy move too.
  const history = await readProjectHistory(supabase, project.id, project.design_schema);

  // The real uploaded photo is always what ends up in the design — product
  // identity must never depend on an AI model's ability to preserve it.
  // AI image generation is used only for the background scene, as
  // text-to-image with no reference. The cutout step is pure image
  // processing (no model), so it can't alter the product either.
  const original = await toDataUri(brief.primaryImageUrl);

  const productAssetsPromise = (async () => {
    try {
      const cutout = await removeProductBackdrop(original);
      if (!cutout.cutoutApplied) {
        return { cutout: original, cutoutApplied: false, aspectRatio: cutout.width / cutout.height };
      }
      const trimmed = await trimTransparentEdges(cutout.dataUri);
      return { cutout: trimmed.dataUri, cutoutApplied: true, aspectRatio: trimmed.width / trimmed.height };
    } catch (err) {
      // A failed cutout must never fail the job — fall back to the photo
      // as uploaded and let the template frame it instead.
      console.error("Product backdrop removal failed, using original photo:", err);
      return { cutout: original, cutoutApplied: false, aspectRatio: 1 };
    }
  })();

  // The models see the product. Writing copy and art direction for a
  // product described only in words is how a matte black bottle ended up
  // in a pastel beach scene.
  const modelImage = await toModelImage(original).catch(() => undefined);
  const textProvider = getTextProvider();

  // One call: it extracts the fact sheet first, then writes the copy,
  // composition, art direction and design brief from it.
  const contentPromise = generateCreative({ provider: textProvider, brief, analysis, image: modelImage, history });

  const [{ data: content }, productAssets] = await Promise.all([contentPromise, productAssetsPromise]);

  const factSheet = normalizeFactSheet(content.factSheet as Partial<FactSheet> | undefined, brief);
  const designBrief = normalizeDesignBrief(content.designBrief);
  const style: ResolvedStyle = {
    ...resolveStyle(preset, content.artDirection),
    accent2: designBrief.secondaryAccent,
    // Recorded on the style so the next regeneration can steer away from it.
    copyAngle: designBrief.copyAngle,
  };

  // Background generation has to wait for the art direction, since the
  // whole point is that the scene is written for this product. It's
  // generated for every design, including templates that don't draw it,
  // so that switching to one that does in the editor has a scene to show.
  const backgroundImageUrl = await getImageProvider()
    .generate({
      prompt: style.backgroundPrompt,
      mode: "text-to-image",
      width: BACKGROUND_RESOLUTION,
      height: BACKGROUND_RESOLUTION,
    })
    .then((r) => toDataUri(r.imageUrl))
    .catch((err) => {
      // Background generation is decorative, not essential — templates
      // fall back to a lit gradient ground rather than fail the whole job.
      console.error("Background image generation failed, falling back to gradient ground:", err);
      return undefined;
    });

  const schema = composeDesignSchema(
    {
      content,
      productCutoutUrl: productAssets.cutout,
      cutoutApplied: productAssets.cutoutApplied,
      productAspectRatio: productAssets.aspectRatio,
      decision,
      style,
      backgroundImageUrl,
      displayName: designBrief.displayName,
      facts: factSheet.facts,
    },
    {
      category: brief.category,
      objective: brief.objective,
      recent: history.templates,
      preferred: designBrief.templatePreferences,
    },
  );

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

export type ProjectHistory = { templates: string[]; moods: string[]; headlines: string[]; angles: string[] };

function templateIdOf(schema: unknown): string | undefined {
  const meta = (schema as { meta?: Record<string, unknown> } | null)?.meta;
  if (!meta) return undefined;
  const composition = meta.composition as { style?: { templateId?: unknown; layout?: unknown } } | undefined;
  const id = composition?.style?.templateId;
  if (typeof id === "string" && getTemplate(id)) return id;
  // Designs from before templates recorded only an arrangement.
  const legacy: Record<string, string> = {
    split: "midnight-split",
    spotlight: "spotlight",
    editorial: "editorial-corner",
    callout: "spec-callout",
  };
  const layout = composition?.style?.layout;
  return typeof layout === "string" ? legacy[layout] : undefined;
}

/**
 * Reads back the designs, moods and headlines this project already used,
 * newest first. The project's current saved design counts too — a user who
 * switched templates in the editor shouldn't be handed that one again.
 */
async function readProjectHistory(
  supabase: ReturnType<typeof createServiceRoleClient>,
  creativeProjectId: string,
  currentSchema: unknown,
): Promise<ProjectHistory> {
  const { data, error } = await supabase
    .from("generated_images")
    .select("design_schema")
    .eq("creative_project_id", creativeProjectId)
    .order("created_at", { ascending: false })
    .limit(12);

  const templates: string[] = [];
  const moods: string[] = [];
  const headlines: string[] = [];
  const angles: string[] = [];

  const rows = [currentSchema, ...(error || !data ? [] : data.map((row) => row.design_schema))];
  for (const schema of rows) {
    const id = templateIdOf(schema);
    if (id && !templates.includes(id)) templates.push(id);

    const composition = (schema as { meta?: { composition?: Record<string, unknown> } } | null)?.meta
      ?.composition as
      | { style?: { moodLabel?: unknown; copyAngle?: unknown }; blocks?: Array<{ type?: string; text?: unknown }> }
      | undefined;
    const mood = composition?.style?.moodLabel;
    if (typeof mood === "string" && mood && !moods.includes(mood) && moods.length < 4) moods.push(mood);
    const angle = composition?.style?.copyAngle;
    if (typeof angle === "string" && angle && !angles.includes(angle) && angles.length < 4) angles.push(angle);
    const headline = composition?.blocks?.find((b) => b.type === "headline")?.text;
    if (typeof headline === "string" && !headlines.includes(headline) && headlines.length < 4) headlines.push(headline);
  }

  // History only improves variety — a failed read never fails a generation.
  return { templates, moods, headlines, angles };
}
