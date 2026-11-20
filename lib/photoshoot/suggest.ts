import "server-only";
import { getTextProvider } from "../ai/providers/factory";
import type { ImageAnalysisResult } from "../ai/providers/types";
import { isHex } from "../orchestration/color";
import { PHOTO_DIRECTOR } from "../ai/personas";

// Photoshoot scene ideas written for one product. The model looks at the
// photo and the seller's details and art-directs sets that suit this
// product's materials, colours, buyer and use — then the user picks.

export type SceneIdea = {
  title: string;
  /** The set, as a photographer's brief — becomes the image prompt. */
  prompt: string;
  /** Why it suits this product, to the seller, in a sentence. */
  why: string;
  /** Where the shot works best: "Instagram", "Product page", ... */
  bestFor: string;
  /** Two hex colours that preview the scene's palette. */
  swatch: [string, string];
};

const SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "2-4 word name, e.g. 'Sunlit linen bedroom'." },
          prompt: {
            type: "string",
            description:
              "A photographer's set brief for a text-to-image model: the surface the product will stand on, " +
              "the environment behind it, light source and direction, colour grade, lens feel, and one or " +
              "two props that echo the product's materials or use, kept at the edges. The centre stays an " +
              "empty, uncluttered surface. Never describe the product itself; never mention text or logos.",
          },
          why: { type: "string", description: "One sentence TO THE SELLER: why this set sells this particular product." },
          bestFor: { type: "string", description: "Where the shot works best, e.g. 'Instagram feed', 'Product page hero', 'Story'." },
          swatchA: { type: "string", description: "Dominant hex colour of the scene." },
          swatchB: { type: "string", description: "Secondary hex colour of the scene." },
        },
        required: ["title", "prompt", "why", "bestFor", "swatchA", "swatchB"],
      },
    },
  },
  required: ["scenes"],
};

type Raw = { scenes?: Array<{ title?: string; prompt?: string; why?: string; bestFor?: string; swatchA?: string; swatchB?: string }> };

export async function suggestScenes(args: {
  product: { name: string | null; category: string | null; description: string | null; attributes?: Record<string, unknown> | null };
  analysis: ImageAnalysisResult | null;
  image?: string;
  /** Titles already suggested, so "more ideas" are genuinely new. */
  avoid?: string[];
}): Promise<SceneIdea[]> {
  const { product, analysis, avoid = [] } = args;
  const { data } = await getTextProvider().generateJSON<Raw>({
    system:
      PHOTO_DIRECTOR +
      " You are planning a lifestyle photoshoot and can see the product photo. Propose six DIFFERENT sets this exact product would be photographed in " +
      "to sell it: draw on its materials, colours, size, who buys it and where it's used. Mix the safe and " +
      "the striking — at least one clean studio set, at least one real-life setting where it's used, and " +
      "at least one bold, scroll-stopping idea. Each set's colours must flatter the product's own colours. " +
      "The product is placed into the set afterwards, so every set has an empty surface in the centre " +
      "foreground for it.",
    temperature: 0.9,
    tier: "expert",
    images: args.image ? [args.image] : undefined,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: product.name,
            category: product.category,
            description: product.description,
            details: product.attributes ?? {},
          },
          readFromPhoto: analysis
            ? {
                productType: analysis.productType,
                materials: analysis.materials,
                colours: analysis.detectedColors,
                visualDetails: analysis.visualDetails,
                style: analysis.styleKeywords,
                audience: analysis.audienceHint,
              }
            : null,
        }),
      },
      ...(avoid.length
        ? [{ role: "user" as const, content: `Already suggested — propose completely different sets: ${avoid.join("; ")}.` }]
        : []),
    ],
    schema: SCHEMA,
  });

  return (data.scenes ?? [])
    .map((s) => ({
      title: (s.title ?? "").trim().slice(0, 60),
      prompt: (s.prompt ?? "").trim().slice(0, 700),
      why: (s.why ?? "").trim().slice(0, 300),
      bestFor: (s.bestFor ?? "").trim().slice(0, 40),
      swatch: [isHex(s.swatchA) ? s.swatchA : "#d9d4cc", isHex(s.swatchB) ? s.swatchB : "#8a8178"] as [string, string],
    }))
    .filter((s) => s.title && s.prompt);
}
