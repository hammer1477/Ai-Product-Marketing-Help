import type { DesignSchema } from "../design-schema/types";
import type { ConceptDecision, CreativeContent } from "./types";
import type { ResolvedStyle } from "./styles";
import { composePosterSchema } from "./templates/poster";
import { composePremiumPhotoSchema } from "./templates/premiumPhoto";
import { composeInfographicSchema } from "./templates/infographic";

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
  const { content, decision, style, backgroundImageUrl } = input;

  if (decision.concept === "premium_photo") {
    // Deliberately the uncut original — this concept is the photo.
    return composePremiumPhotoSchema(content, input.productImageUrl, style);
  }

  if (decision.concept === "infographic") {
    return composeInfographicSchema({
      content,
      productImageUrl: input.productCutoutUrl,
      style,
      cutoutApplied: input.cutoutApplied,
      productAspectRatio: input.productAspectRatio,
      backgroundImageUrl,
    });
  }

  return composePosterSchema({
    content,
    productImageUrl: input.productCutoutUrl,
    density: decision.density,
    style,
    backgroundImageUrl,
    cutoutApplied: input.cutoutApplied,
    productAspectRatio: input.productAspectRatio,
  });
}
