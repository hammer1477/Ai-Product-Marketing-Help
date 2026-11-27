import "server-only";
import { getTextProvider } from "../ai/providers/factory";
import type { ImageAnalysisResult } from "../ai/providers/types";
import { CREATIVE_DIRECTOR } from "../ai/personas";
import type { Block } from "../orchestration/blocks/types";
import type { Fact } from "../orchestration/factSheet";
import { claimScrubber, sellerText } from "../orchestration/claims";

// On-demand copy for one section of a poster, from the editor's "Suggest"
// button. The same honesty rules as generation: everything comes from the
// seller, the photo, or qualitative category knowledge — never an invented
// number, certification, rating or guarantee.

export type SuggestType = "headline" | "subheadline" | "description" | "featureList" | "specGrid";

export const SUGGEST_TYPES: SuggestType[] = ["headline", "subheadline", "description", "featureList", "specGrid"];

export type Suggestions =
  | { type: "headline" | "subheadline" | "description" | "featureList"; options: string[] }
  | { type: "specGrid"; options: Array<{ label: string; value: string }> };

const TASK: Record<SuggestType, string> = {
  headline:
    "Write 6 headline options, 3-7 words each, each built on a DIFFERENT angle (the outcome, the sensory moment, " +
    "the occasion, the standout detail, the buyer's wish, a bold statement). Every one could only be about this product.",
  subheadline:
    "Write 5 subheadline options: one line, 6-12 words, that completes the headline's promise with a concrete detail.",
  description:
    "Write 4 description options. Each is two short sentences (max 32 words total) a buyer would actually want to " +
    "read: what it is, what it's like to have or use, and why it's worth it — specific and sensory, never a " +
    "restatement of the headline. Vary the angle between options.",
  featureList:
    "Write 8 feature lines, 3-7 words each: concrete reasons to buy, each a different fact or benefit. Lead with the " +
    "most persuasive. A measurement alone is not a feature — say what it does for the buyer.",
  specGrid:
    "Write 6 specification pairs: a 1-2 word label and a 1-5 word value ('Base' / 'Golden biscuit crumb', " +
    "'Finish' / 'Brushed steel'). Use measurable specs only when the seller or packaging states them; otherwise " +
    "concrete attributes — materials, construction, contents, finish, flavour, fit.",
};

const HONESTY =
  "Sources you may use: the seller's description and fields, what is visible in the product photo, and qualitative " +
  "facts inherently true of this exact product type as shown (what any expert in the category would say). NEVER " +
  "invent numbers, sizes, weights, quantities, servings, durations, percentages, prices, origins, certifications, " +
  "awards, ratings, reviews, stock levels, shipping or guarantees, and never claim how or where it is made or what " +
  "it is free of (handmade, homemade, hand-finished, artisan, organic, natural, all-natural, fresh-baked daily, locally made, imported, eco-friendly, vegan, gluten-free, sugar-free, healthy) — only use those if the seller stated them. " +
  "Never repeat anything already on the poster. Write in the seller's language and tone.";

export async function suggestBlock(args: {
  type: SuggestType;
  product: { name: string | null; category: string | null; description: string | null; attributes?: Record<string, unknown> | null };
  analysis: ImageAnalysisResult | null;
  image?: string;
  blocks: Block[];
  facts?: Fact[];
}): Promise<Suggestions> {
  const { type, product, analysis } = args;
  const onPoster = args.blocks.flatMap((b): string[] => {
    if ("text" in b) return [`${b.type}: ${b.text}`];
    if ("items" in b) return b.items.map((i) => `${b.type}: ${typeof i === "string" ? i : `${i.label} ${i.value}`}`);
    return [];
  });

  const isSpec = type === "specGrid";
  const schema = {
    type: "object",
    properties: {
      options: {
        type: "array",
        items: isSpec
          ? {
              type: "object",
              properties: { label: { type: "string" }, value: { type: "string" } },
              required: ["label", "value"],
              propertyOrdering: ["label", "value"],
            }
          : { type: "string" },
      },
    },
    required: ["options"],
  };

  const { data } = await getTextProvider().generateJSON<{ options?: unknown[] }>({
    system: `${CREATIVE_DIRECTOR} You are writing one section of a product poster on request, and you can see the product photo. ${TASK[type]} ${HONESTY}`,
    temperature: 0.85,
    tier: "expert",
    images: args.image ? [args.image] : undefined,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          product: { name: product.name, category: product.category, description: product.description, details: product.attributes ?? {} },
          readFromPhoto: analysis
            ? {
                productType: analysis.productType,
                printedText: analysis.detectedText,
                printedClaims: analysis.visibleClaims,
                materials: analysis.materials,
                visualDetails: analysis.visualDetails,
                colours: analysis.detectedColors,
                style: analysis.styleKeywords,
              }
            : null,
          knownFacts: (args.facts ?? []).slice(0, 24).map((f) => `${f.label}: ${f.value}`),
          alreadyOnPoster: onPoster,
        }),
      },
      { role: "user", content: `Variation token: ${Math.random().toString(36).slice(2, 8)}` },
    ],
    schema,
  });

  // Same claim scrubbing as generation, and the same length discipline.
  const scrub = claimScrubber(sellerText(product as { name?: string | null; description?: string | null; attributes?: Record<string, unknown> }));
  const raw = Array.isArray(data.options) ? data.options : [];
  if (isSpec) {
    const options = raw
      .map((o) => o as { label?: unknown; value?: unknown })
      .map((o) => ({ label: scrub.text(String(o.label ?? "")).slice(0, 24), value: scrub.text(String(o.value ?? "")).slice(0, 48) }))
      .filter((o) => o.label && o.value)
      .slice(0, 8);
    return { type: "specGrid", options };
  }
  const max = type === "description" ? 240 : type === "featureList" ? 60 : 90;
  const options = raw
    .map((o) => scrub.text(String(o ?? "")).replace(/\s+/g, " ").trim())
    .filter((o) => o.length > 1)
    .map((o) => (o.length > max ? `${o.slice(0, max - 1).trimEnd()}…` : o))
    .filter((o, i, all) => all.indexOf(o) === i)
    .slice(0, 8);
  return { type, options };
}
