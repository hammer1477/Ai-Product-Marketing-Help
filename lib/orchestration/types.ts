import type { DesignDensity } from "../design-schema/types";
import { BLOCKS_SCHEMA, type RawBlock } from "./blocks/types";

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

/** Poster arrangements the art director can choose between. */
export type LayoutVariant = "split" | "spotlight" | "editorial";

export const LAYOUT_VARIANTS: LayoutVariant[] = ["split", "spotlight", "editorial"];

// The art direction half of the generation call. Hardcoded category presets
// gave every product in a category an identical-looking ad, which is the
// fastest way to make output feel templated. Here the model acts as art
// director for *this specific product*: it writes the scene the product
// should sit in, picks the palette from the product's own look, and chooses
// an arrangement. Presets remain as the fallback when the model's output
// fails validation, so a bad response degrades to "generic but correct"
// rather than to a broken design.
export type ArtDirection = {
  /** Text-to-image prompt for the background scene. Never the product itself. */
  scenePrompt: string;
  layout: LayoutVariant;
  headlineFont: "Playfair Display" | "Inter";
  /** Deep ground colour the copy sits on. */
  colorInk: string;
  /** Accent for badge, CTA fill, dividers, icons. */
  colorAccent: string;
  colorTextPrimary: string;
  colorTextMuted: string;
  /** Short human label for this direction, e.g. "midnight studio". */
  moodLabel: string;
};

export type CreativeContent = {
  headline: string;
  productName: string;
  description: string;
  sellingPoints: string[];
  ctaLabel: string;
  badgeLabel?: string;
  artDirection?: ArtDirection;
  /**
   * The composed poster content. The flat fields above remain the source of
   * truth for concepts that don't use blocks (premium photo, infographic)
   * and as the fallback when block composition fails validation.
   */
  blocks?: RawBlock[];
};

export const CREATIVE_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "Punchy ad headline, max 7 words." },
    productName: { type: "string" },
    description: {
      type: "string",
      description: "One or two sentences, max 28 words. Must fit on a poster.",
    },
    sellingPoints: {
      type: "array",
      items: { type: "string", description: "Max 6 words each. No trailing period." },
      minItems: 3,
      maxItems: 5,
    },
    ctaLabel: { type: "string", description: "Max 3 words, e.g. 'Shop now'. Never include a price." },
    badgeLabel: { type: "string", description: "Max 2 words, e.g. the brand or 'New'." },
    blocks: BLOCKS_SCHEMA,
    artDirection: {
      type: "object",
      description: "Art direction tailored to THIS product's own look and market.",
      properties: {
        scenePrompt: {
          type: "string",
          description:
            "A vivid text-to-image prompt for the BACKGROUND SCENE this product will be " +
            "placed into — an environment, surface, lighting and mood that suits this exact " +
            "product. Describe materials, light direction, colour, atmosphere and depth. " +
            "Compose it as a backdrop, not as a photograph in its own right: describe an " +
            "empty surface or pedestal in the middle distance and uncluttered space where a " +
            "product will stand, with the detail and drama pushed to the edges and the " +
            "background. A busy centre makes the product look pasted on. " +
            "Never describe the product itself and never mention text, logos or watermarks.",
        },
        layout: {
          type: "string",
          enum: ["split", "spotlight", "editorial"],
          description:
            "split = copy column beside the product (best for feature-rich products). " +
            "spotlight = product centred, copy in a band below (best for beautiful objects). " +
            "editorial = oversized headline, product bleeding off a corner (best for fashion/lifestyle).",
        },
        headlineFont: {
          type: "string",
          enum: ["Playfair Display", "Inter"],
          description: "Playfair Display for luxury/editorial/beauty; Inter for tech/sport/modern.",
        },
        colorInk: {
          type: "string",
          description: "Deep background hex like #0b0b0d, drawn from the product's world.",
        },
        colorAccent: {
          type: "string",
          description: "Vivid accent hex that complements the product and pops against colorInk.",
        },
        colorTextPrimary: { type: "string", description: "Near-white or near-black hex, high contrast on colorInk." },
        colorTextMuted: { type: "string", description: "Softer hex for body copy, readable on colorInk." },
        moodLabel: { type: "string", description: "Two or three words naming this direction." },
      },
      required: [
        "scenePrompt",
        "layout",
        "headlineFont",
        "colorInk",
        "colorAccent",
        "colorTextPrimary",
        "colorTextMuted",
        "moodLabel",
      ],
    },
  },
  required: [
    "headline",
    "productName",
    "description",
    "sellingPoints",
    "ctaLabel",
    "blocks",
    "artDirection",
  ],
};

export type ConceptDecision = {
  concept: CreativeConcept;
  density: DesignDensity;
};
