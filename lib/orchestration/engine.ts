import { createServiceRoleClient } from "../db/supabase/server";
import { renderSchemaToPng } from "../design-schema/render/renderPng";
import { hasBlockingErrors, validateDesignSchema } from "../design-schema/validate";
import { getImageProvider, getTextProvider } from "../ai/providers/factory";
import { composeDesignSchema } from "./composeDesignSchema";
import { decideConcept } from "./decideConcept";
import { decideStyle } from "./styles";
import { toDataUri } from "./toDataUri";
import { CREATIVE_CONTENT_SCHEMA, type CreativeBrief, type CreativeContent } from "./types";

const EXPORT_SCALE = 2;

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
  const style = decideStyle(brief.category);

  // Copy generation, inlining the real product photo, and the decorative
  // background generation are all independent — run them concurrently
  // instead of sequentially so total latency is max(...) rather than sum(...).
  const textProvider = getTextProvider();
  const contentPromise = textProvider.generateJSON<CreativeContent>({
    system:
      "You are an advertising copywriter. Write persuasive, truthful ad copy using ONLY the verified " +
      "product information provided. Never invent specifications, certifications, or claims not present " +
      "in the input.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          name: brief.name,
          category: brief.category,
          description: brief.description,
          objective: brief.objective,
          attributes: brief.attributes,
        }),
      },
    ],
    schema: CREATIVE_CONTENT_SCHEMA,
  });

  // The real uploaded photo is always what ends up in the design — product
  // identity must never depend on an AI model's ability to preserve it.
  // AI image generation is used only for a decorative background behind
  // the real photo (graphic_poster concept), and only as text-to-image
  // with no reference, since that's the one thing it can't get wrong.
  const productImagePromise = toDataUri(brief.primaryImageUrl);

  const backgroundPromise: Promise<string | undefined> =
    decision.concept === "graphic_poster"
      ? getImageProvider()
          .generate({ prompt: style.backgroundPrompt, mode: "text-to-image", width: 580, height: 1080 })
          .then((r) => toDataUri(r.imageUrl))
          .catch((err) => {
            // Background generation is decorative, not essential — fall
            // back to the flat style color rather than fail the whole job.
            console.error("Background image generation failed, falling back to flat color:", err);
            return undefined;
          })
      : Promise.resolve(undefined);

  const [{ data: content }, productImageUrl, backgroundImageUrl] = await Promise.all([
    contentPromise,
    productImagePromise,
    backgroundPromise,
  ]);

  const schema = composeDesignSchema(content, productImageUrl, decision, style, backgroundImageUrl);

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
