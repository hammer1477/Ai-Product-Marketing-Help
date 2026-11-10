import type { DesignSchema } from "../design-schema/types";
import type { ConceptDecision, CreativeContent } from "./types";
import type { StylePreset } from "./styles";
import { composePosterSchema } from "./templates/poster";
import { composePremiumPhotoSchema } from "./templates/premiumPhoto";
import { composeInfographicSchema } from "./templates/infographic";

export function composeDesignSchema(
  content: CreativeContent,
  productImageUrl: string,
  decision: ConceptDecision,
  style: StylePreset,
  backgroundImageUrl?: string,
): DesignSchema {
  if (decision.concept === "premium_photo") {
    return composePremiumPhotoSchema(content, productImageUrl, style);
  }
  if (decision.concept === "infographic") {
    return composeInfographicSchema(content, productImageUrl, style);
  }
  return composePosterSchema(content, productImageUrl, decision.density, style, backgroundImageUrl);
}
