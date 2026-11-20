import { createServiceRoleClient } from "../db/supabase/server";
import { getImageProvider, getTextProvider } from "../ai/providers/factory";
import type { ImageAnalysisResult } from "../ai/providers/types";
import { applyBrandFonts, applyBrandStyle, BRAND_KIT_COLUMNS, readBrandKit, type BrandKit } from "../brand/kit";
import { renderSchemaToPng } from "../design-schema/render/renderPng";
import { hasBlockingErrors, validateDesignSchema } from "../design-schema/validate";
import { removeProductBackdrop, trimTransparentEdges } from "../images/cutout";
import { toModelImage } from "../images/modelImage";
import { angleById, type CopyAngle } from "../orchestration/angles";
import { composeDesignSchema } from "../orchestration/composeDesignSchema";
import { decideConcept } from "../orchestration/decideConcept";
import { normalizeDesignBrief, TEMPLATE_CATALOGUE } from "../orchestration/designBrief";
import { EXTRACTION_RULES, normalizeFactSheet, type FactSheet } from "../orchestration/factSheet";
import { formatForPlatform } from "../orchestration/formats";
import { decideStyle, resolveStyle, type ResolvedStyle } from "../orchestration/styles";
import { toDataUri } from "../orchestration/toDataUri";
import type { CreativeBrief, CreativeContent } from "../orchestration/types";
import { campaignSchema, matchAds, normalizePlan, type RawCampaign } from "./plan";
import { claimScrubber, dropEmptyBlocks, sellerText } from "../orchestration/claims";

const EXPORT_SCALE = 2;
const BACKGROUND_RESOLUTION = 1536;

/**
 * Runs a whole campaign as one job: the strategist writes the plan, one
 * background scene is generated for the shared look, then every ad is
 * designed from the plan. Throws on failure — runJob refunds the lot.
 */
export async function runCampaignGeneration(jobId: string): Promise<{ campaignId: string }> {
  const supabase = createServiceRoleClient();

  const { data: job } = await supabase.from("generation_jobs").select("id, user_id, product_id, params").eq("id", jobId).single();
  const campaignId = (job?.params as { campaign_id?: string } | null)?.campaign_id;
  if (!job?.product_id || !campaignId) throw new Error(`Campaign job not found: ${jobId}`);

  const [{ data: campaign }, { data: projects }, { data: product }, { data: kitRow }] = await Promise.all([
    supabase.from("campaigns").select("id, color_source").eq("id", campaignId).single(),
    supabase.from("creative_projects").select("id, angle, variant_index").eq("campaign_id", campaignId).order("variant_index"),
    supabase.from("products").select("*").eq("id", job.product_id).single(),
    supabase.from("brand_kits").select(BRAND_KIT_COLUMNS).eq("user_id", job.user_id).maybeSingle(),
  ]);
  if (!campaign || !projects?.length || !product) throw new Error("Campaign, its ads or its product is missing");
  if (!product.category_confirmed) throw new Error("Product category has not been confirmed.");
  const brand = readBrandKit(kitRow);

  const { data: primary } = await supabase
    .from("product_images")
    .select("storage_path, ai_analysis")
    .eq("product_id", product.id)
    .eq("is_primary", true)
    .single();
  if (!primary) throw new Error("Product has no primary photo");
  const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(primary.storage_path, 300);
  if (!signed) throw new Error("Couldn't read the product photo");

  const brief: CreativeBrief = {
    productId: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    objective: product.objective,
    targetPlatform: product.target_platform,
    attributes: product.attributes ?? {},
    primaryImageUrl: signed.signedUrl,
  };
  const analysis = (primary.ai_analysis ?? null) as ImageAnalysisResult | null;
  const original = await toDataUri(brief.primaryImageUrl);

  const cutoutPromise = (async () => {
    try {
      const cut = await removeProductBackdrop(original);
      if (!cut.cutoutApplied) return { src: original, applied: false, ratio: cut.width / cut.height };
      const t = await trimTransparentEdges(cut.dataUri);
      return { src: t.dataUri, applied: true, ratio: t.width / t.height };
    } catch {
      return { src: original, applied: false, ratio: 1 };
    }
  })();

  const angles = projects.map((p) => angleById(p.angle)).filter((a): a is CopyAngle => Boolean(a));
  const modelImage = await toModelImage(original).catch(() => undefined);
  const [{ data: written }, cutout] = await Promise.all([
    writeCampaign({ brief, analysis, image: modelImage, brand, angles }),
    cutoutPromise,
  ]);

  // Unbackable claims ("viral", "in stock") are stripped from every ad and
  // its social copy — the prompt forbids them, this catches what slips.
  const scrub = claimScrubber(sellerText(brief));
  const raw: RawCampaign = {
    ...written,
    ads: written.ads?.map((ad) => ({ ...scrub.deep(ad), blocks: dropEmptyBlocks(scrub.deep(ad.blocks) as { type?: string; text?: unknown }[]) })),
  };

  const matched = matchAds(raw.ads, projects.map((p) => ({ id: p.id, angle: p.angle ?? "" })));
  const plan = normalizePlan(raw, matched);
  const factSheet = normalizeFactSheet(raw.factSheet as Partial<FactSheet> | undefined, brief);
  const designBrief = normalizeDesignBrief(raw.designBrief as never);

  // ONE look for the whole campaign.
  const artDirected = resolveStyle(decideStyle(brief.category), raw.artDirection);
  const productColors = { ink: artDirected.ink, accent: artDirected.accent, text: artDirected.textPrimary, muted: artDirected.textMuted };
  const useBrandColors = Boolean(brand?.colors) && campaign.color_source !== "product";
  const style: ResolvedStyle = {
    ...(useBrandColors ? applyBrandStyle(artDirected, brand) : applyBrandFonts(artDirected, brand)),
    productColors,
    colorSource: useBrandColors ? "brand" : "product",
    accent2: designBrief.secondaryAccent,
    format: formatForPlatform(brief.targetPlatform),
  };

  const background = await getImageProvider()
    .generate({ prompt: style.backgroundPrompt, mode: "text-to-image", width: BACKGROUND_RESOLUTION, height: BACKGROUND_RESOLUTION })
    .then((r) => toDataUri(r.imageUrl))
    .catch((err) => {
      console.error("Campaign background failed, using gradient grounds:", err);
      return undefined;
    });

  const decision = decideConcept(brief);
  for (const [i, { project, ad }] of matched.entries()) {
    if (!ad) throw new Error(`The strategist didn't write an ad for "${project.angle}"`);
    const content: CreativeContent = {
      headline: ad.headline ?? "",
      productName: ad.productName ?? product.name,
      description: ad.description ?? "",
      sellingPoints: ad.sellingPoints ?? [],
      ctaLabel: ad.ctaLabel ?? "Shop now",
      badgeLabel: ad.badgeLabel,
      blocks: ad.blocks as CreativeContent["blocks"],
      artDirection: raw.artDirection,
    };
    const schema = composeDesignSchema(
      {
        content,
        productCutoutUrl: cutout.src,
        cutoutApplied: cutout.applied,
        productAspectRatio: cutout.ratio,
        decision,
        style: { ...style, copyAngle: angleById(project.angle)?.label },
        backgroundImageUrl: background,
        displayName: designBrief.displayName ?? brand?.brandName,
        facts: factSheet.facts,
        logo: brand?.logo,
      },
      {
        category: brief.category,
        objective: brief.objective,
        recent: [],
        preferred: designBrief.templatePreferences,
        // Same look, different designs: each ad draws from its own slice.
        slice: { index: i, of: matched.length },
      },
    );
    const issues = validateDesignSchema(schema);
    if (hasBlockingErrors(issues)) throw new Error(`Design validation failed: ${issues.map((x) => x.message).join("; ")}`);

    const png = await renderSchemaToPng(schema, { scale: EXPORT_SCALE });
    const path = `${project.id}/${jobId}.png`;
    const { error: upErr } = await supabase.storage.from("generated-images").upload(path, png, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(`Failed to upload ad: ${upErr.message}`);
    const { error: insErr } = await supabase.from("generated_images").insert({
      creative_project_id: project.id,
      job_id: jobId,
      storage_path: path,
      design_schema: schema,
      width: schema.canvas.width * EXPORT_SCALE,
      height: schema.canvas.height * EXPORT_SCALE,
    });
    if (insErr) throw new Error(`Failed to save ad: ${insErr.message}`);
    await supabase
      .from("creative_projects")
      .update({ concept: decision.concept, density: decision.density, design_schema: schema, preview_path: null })
      .eq("id", project.id);
  }

  const { error: planErr } = await supabase.from("campaigns").update({ plan }).eq("id", campaignId);
  if (planErr) throw new Error(`Failed to save the campaign plan: ${planErr.message}`);
  return { campaignId };
}

function writeCampaign(args: {
  brief: CreativeBrief;
  analysis: ImageAnalysisResult | null;
  image?: string;
  brand: BrandKit | null;
  angles: CopyAngle[];
}) {
  const { brief, analysis, brand, angles } = args;
  return getTextProvider().generateJSON<RawCampaign>({
    system:
      "You are the strategy director of a leading performance-marketing agency, running a paid and " +
      "organic campaign on Instagram and Facebook for a small-business client. You can see the product " +
      "photo. Your client is not a marketer: everything addressed to them must be plain, specific and " +
      "actionable. Work in the order of the response fields. " +
      "STEP 1 - EXTRACT the fact sheet. " +
      EXTRACTION_RULES +
      " Everything after this step may use ONLY facts on your fact sheet — never invent specifications, " +
      "prices, ratings, reviews, discounts or claims. This applies to EVERY string you write: posters, " +
      "badges, captions, hashtags and ad text alike. Unless the seller's own fields state it, never say " +
      "or imply: bestseller, best-selling, viral, internet-famous, trending, popular, back in stock, in " +
      "stock, limited stock, selling fast, fast/free shipping or delivery, guarantees, warranties, " +
      "discounts, sale prices, or numbers of customers or reviews. Sell with what the product IS. " +
      "STEP 2 - STRATEGY: one big idea for the whole campaign, the audiences to target and why. " +
      "STEP 3 - ONE LOOK: a single art direction (palette from the product's own colours and materials, " +
      "one background scene) that every ad shares, so the set reads as one campaign. Rank designs from the " +
      "catalogue below that suit it. " +
      "STEP 4 - THE ADS: one ad per assigned angle, in order. Each ad's poster copy commits fully to its " +
      "angle and pulls on the big idea; keep every poster string short enough to read at a glance. Write " +
      "its social copy and pick its placements. " +
      "STEP 5 - THE PLAYBOOK: how the client launches, tests, reads results and scales — concrete enough " +
      "for a beginner to follow in Meta Ads Manager.\n\n" +
      "POSTER DESIGN CATALOGUE (id: name — look (scheme; suits)):\n" +
      TEMPLATE_CATALOGUE,
    temperature: 0.7,
    images: args.image ? [args.image] : undefined,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          seller: {
            name: brief.name,
            category: brief.category,
            objective: brief.objective,
            targetPlatform: brief.targetPlatform,
            description: brief.description,
            fields: brief.attributes,
          },
          readFromPhoto: analysis
            ? {
                productType: analysis.productType,
                brand: analysis.brandGuess,
                printedText: analysis.detectedText,
                printedClaims: analysis.visibleClaims,
                materials: analysis.materials,
                visualDetails: analysis.visualDetails,
                colours: analysis.detectedColors,
                style: analysis.styleKeywords,
              }
            : null,
          brand: brand
            ? { name: brand.brandName, tagline: brand.tagline, voice: brand.voice, fixedPalette: Boolean(brand.colors) }
            : null,
          assignedAngles: angles.map((a, i) => ({ order: i + 1, id: a.id, angle: a.label, brief: a.brief })),
        }),
      },
      ...(brand?.voice
        ? [{ role: "user" as const, content: `Write every line — posters, captions, ad text — in the brand voice: ${brand.voice}.` }]
        : []),
    ],
    schema: campaignSchema(angles.length),
  });
}
