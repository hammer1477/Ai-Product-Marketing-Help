import type { DesignSchema } from "../design-schema/types";
import type { ConceptDecision, CreativeContent } from "./types";
import { composePosterSchema } from "./templates/poster";
import { composePremiumPhotoSchema } from "./templates/premiumPhoto";

export function composeDesignSchema(
  content: CreativeContent,
  imageUrl: string,
  decision: ConceptDecision,
): DesignSchema {
  if (decision.concept === "premium_photo") {
    return composePremiumPhotoSchema(content, imageUrl);
  }
  return composePosterSchema(content, imageUrl, decision.density);
}
