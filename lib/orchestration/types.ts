import type { DesignDensity } from "../design-schema/types";

export type CreativeConcept = "premium_photo" | "graphic_poster" | "infographic";

export type CreativeBrief = {
  productId: string;
  name: string;
  category: string;
  description: string | null;
  objective: string | null;
  targetPlatform: string | null;
  attributes: Record<string, string>;
  primaryImageUrl: string;
};

export type CreativeContent = {
  headline: string;
  productName: string;
  description: string;
  sellingPoints: string[];
  ctaLabel: string;
  badgeLabel?: string;
};

export const CREATIVE_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    productName: { type: "string" },
    description: { type: "string" },
    sellingPoints: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    ctaLabel: { type: "string" },
    badgeLabel: { type: "string" },
  },
  required: ["headline", "productName", "description", "sellingPoints", "ctaLabel"],
};

export type ConceptDecision = {
  concept: CreativeConcept;
  density: DesignDensity;
};
