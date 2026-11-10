import type { DesignSchema } from "../design-schema/types";
import type { ConceptDecision, CreativeContent } from "./types";
import type { ResolvedStyle } from "./styles";
import { composePosterSchema } from "./templates/poster";
import { composePremiumPhotoSchema } from "./templates/premiumPhoto";
import { normalizeBlocks } from "./blocks/types";

export type ComposeInput = {
  content: CreativeContent;
  /** The photo exactly as uploaded. */
  productImageUrl: string;
  /** Same photo with its studio backdrop removed, when that was possible. */
  productCutoutUrl: string;
  cutoutApplied: boolean;
  /** Intrinsic aspect ratio (w/h) of the cutout, for grounding the product. */
  productAspectRatio: number;
  decision: ConceptDecision;
  style: ResolvedStyle;
  backgroundImageUrl?: string;
};

export function composeDesignSchema(input: ComposeInput): DesignSchema {
  const { content, decision, backgroundImageUrl } = input;

  if (decision.concept === "premium_photo") {
    // Deliberately the uncut original — this concept is the photo.
    return composePremiumPhotoSchema(content, input.productImageUrl, input.style);
  }

  // The model composes the poster; normalizeBlocks is the gate that turns
  // its loose output into something renderable, synthesizing a headline and
  // a button from the flat copy fields if either is missing.
  const blocks = normalizeBlocks(content.blocks, {
    headline: content.headline,
    ctaLabel: content.ctaLabel,
    sellingPoints: content.sellingPoints ?? [],
  });

  // The infographic concept is the callout arrangement — it used to be a
  // separate template duplicating the same leader-line drawing, and it now
  // just pins the layout so every other decision stays shared.
  const style =
    decision.concept === "infographic" ? { ...input.style, layout: "callout" as const } : input.style;

  return composePosterSchema({
    blocks,
    productImageUrl: input.productCutoutUrl,
    density: decision.density,
    style,
    backgroundImageUrl,
    cutoutApplied: input.cutoutApplied,
    productAspectRatio: input.productAspectRatio,
  });
}
