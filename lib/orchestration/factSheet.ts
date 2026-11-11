import type { CreativeBrief } from "./types";

// The fact sheet: the first thing the generation call writes.
//
// When extraction was implicit, the model skimmed the input on its way to
// writing a headline — a description carrying eight facts produced a
// poster carrying three. Now it must first write out every fact it found,
// as its own field, before any creative field (see creative.ts for why
// that ordering holds within a single call). Every fact carries its
// source, so "printed on the box" and "the seller said so" are both
// admissible while "the model assumed" is not.

export type FactKind =
  | "spec"
  | "feature"
  | "benefit"
  | "material"
  | "ingredient"
  | "dimension"
  | "usage"
  | "included"
  | "compatibility"
  | "certification"
  | "care"
  | "price"
  | "offer"
  | "other";

export type FactSource = "description" | "attributes" | "photo";

export type Fact = {
  /** Short name, poster-ready: "Battery", "Lens", "Finish". */
  label: string;
  /** The fact itself, poster-ready: "57 hours", "CR-39 polymer". */
  value: string;
  kind: FactKind;
  source: FactSource;
  /** 1–5: how much this fact would sell the product on a poster. */
  strength: number;
};

export type FactSheet = {
  productType: string;
  brand?: string;
  audience: string;
  /** The single strongest reason to buy, in a customer's words. */
  primaryBenefit: string;
  /** The feeling the ad should leave — aspiration, relief, delight. */
  emotionalHook: string;
  /** What sets it apart from the obvious alternatives, from the facts only. */
  differentiators: string[];
  facts: Fact[];
  /** A promotion the seller actually stated, if any. */
  offer?: string;
};

const FACT_KINDS: FactKind[] = [
  "spec",
  "feature",
  "benefit",
  "material",
  "ingredient",
  "dimension",
  "usage",
  "included",
  "compatibility",
  "certification",
  "care",
  "price",
  "offer",
  "other",
];

export const FACT_SHEET_SCHEMA = {
  type: "object",
  properties: {
    productType: { type: "string" },
    brand: { type: "string", description: "Only if stated or legibly printed." },
    audience: { type: "string", description: "Who this is for, inferred from the product and description." },
    primaryBenefit: { type: "string", description: "Max 8 words. The strongest reason to buy." },
    emotionalHook: { type: "string", description: "Max 8 words. The feeling the ad should create." },
    differentiators: {
      type: "array",
      items: { type: "string", description: "Max 8 words." },
      description: "Up to 4 things that genuinely set this product apart, supported by the facts.",
    },
    facts: {
      type: "array",
      description:
        "EVERY concrete fact found, one per entry — aim for 12 to 24 when the input supports it. " +
        "Split compound sentences into separate facts.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Max 3 words, e.g. 'Battery life'." },
          value: { type: "string", description: "Max 6 words, e.g. 'Up to 57 hours'." },
          kind: { type: "string", enum: FACT_KINDS },
          source: { type: "string", enum: ["description", "attributes", "photo"] },
          strength: { type: "number", description: "1-5: how persuasive this fact is on a poster." },
        },
        propertyOrdering: ["label", "value", "kind", "source", "strength"],
        required: ["label", "value", "kind", "source", "strength"],
      },
    },
    offer: { type: "string", description: "Only a promotion explicitly stated by the seller." },
  },
  propertyOrdering: [
    "productType",
    "brand",
    "facts",
    "audience",
    "primaryBenefit",
    "emotionalHook",
    "differentiators",
    "offer",
  ],
  required: ["productType", "audience", "primaryBenefit", "emotionalHook", "differentiators", "facts"],
};

/** How to fill the fact sheet — the first step of the generation call. */
export const EXTRACTION_RULES =
  "Sources: (1) the seller's description and fields, (2) a vision model's reading of the product " +
  "photo, (3) the photo itself. " +
  "Extract EVERY concrete, checkable fact: materials, dimensions, weights, capacities, durations, " +
  "quantities, ingredients and their percentages, compatibility, connectivity, certifications, what's " +
  "included, how to use it, care, price, stated offers, and the benefits these facts directly imply. " +
  "Facts hide in prose: 'golden metal frames with black CR-39 lenses and full UV protection coating' " +
  "is four facts. Text printed on the product or packaging counts as a fact with source 'photo'. " +
  "A benefit is admissible only when it follows directly from a stated fact ('UV400 lenses' -> " +
  "'Blocks 100% of UV rays'). " +
  "Never invent: no unstated prices, ratings, review counts, awards, percentages or measurements. " +
  "If the input is thin, return fewer facts rather than padding. Write labels and values short " +
  "enough to print on a poster.";

const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
};

/** Treats the model's sheet as untrusted: trims, dedupes, caps, ranks. */
export function normalizeFactSheet(raw: Partial<FactSheet> | null | undefined, brief: CreativeBrief): FactSheet {
  const seen = new Set<string>();
  const facts: Fact[] = [];
  for (const item of raw?.facts ?? []) {
    const label = clean(item?.label, 32);
    const value = clean(item?.value, 60);
    if (!label || !value) continue;
    const key = `${label}|${value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({
      label,
      value,
      kind: FACT_KINDS.includes(item.kind as FactKind) ? (item.kind as FactKind) : "other",
      source: item.source === "photo" || item.source === "attributes" ? item.source : "description",
      strength: Math.max(1, Math.min(5, Math.round(Number(item.strength) || 3))),
    });
  }
  facts.sort((a, b) => b.strength - a.strength);

  return {
    productType: clean(raw?.productType, 60) ?? brief.category,
    brand: clean(raw?.brand, 40) ?? brief.attributes.brandName ?? undefined,
    audience: clean(raw?.audience, 120) ?? "",
    primaryBenefit: clean(raw?.primaryBenefit, 80) ?? "",
    emotionalHook: clean(raw?.emotionalHook, 80) ?? "",
    differentiators: (raw?.differentiators ?? [])
      .map((d) => clean(d, 80))
      .filter((d): d is string => d !== null)
      .slice(0, 4),
    facts: facts.slice(0, 30),
    offer: clean(raw?.offer, 80) ?? brief.attributes.offer ?? undefined,
  };
}
