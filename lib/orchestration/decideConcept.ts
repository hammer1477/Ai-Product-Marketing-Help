import type { ConceptDecision, CreativeBrief } from "./types";

const BRAND_AWARENESS_CATEGORIES = new Set(["Beauty & Skincare", "Fashion & Apparel", "Food & Beverage"]);
const PROMO_OBJECTIVES = new Set(["sales-conversion", "discount-campaign", "seasonal-promotion"]);
const SPEC_HEAVY_CATEGORIES = new Set(["Electronics & Technology", "Health & Wellness"]);

// Deterministic, unit-testable rule function — not an LLM call. Phase 1
// prioritizes cost/latency/determinism here; swapping this for an LLM-driven
// decision later requires no change to callers since the return shape is
// stable (see lib/orchestration/types.ts#ConceptDecision).
export function decideConcept(brief: CreativeBrief): ConceptDecision {
  const { category, objective } = brief;

  if (objective && PROMO_OBJECTIVES.has(objective)) {
    return {
      concept: "graphic_poster",
      density: SPEC_HEAVY_CATEGORIES.has(category) ? "detailed" : "standard",
    };
  }

  if (objective === "brand-awareness" && BRAND_AWARENESS_CATEGORIES.has(category)) {
    return { concept: "premium_photo", density: "minimal" };
  }

  // Spec-heavy categories read better as itemized feature callouts than as
  // a single paragraph (spec section 3: "electronics advertisement may
  // need specifications, technical features...").
  if (SPEC_HEAVY_CATEGORIES.has(category)) {
    return { concept: "infographic", density: "detailed" };
  }

  return { concept: "graphic_poster", density: "standard" };
}
