import type { ImageAnalysisResult, TextGenerationProvider } from "../ai/providers/types";
import { creativeSchemaWithBrief, TEMPLATE_CATALOGUE } from "./designBrief";
import { EXTRACTION_RULES } from "./factSheet";
import type { CreativeBrief, CreativeContent } from "./types";
import type { BrandKit } from "../brand/kit";
import type { CopyAngle } from "./angles";
import { CREATIVE_DIRECTOR } from "../ai/personas";

export type CreativeHistory = {
  templates: string[];
  moods: string[];
  headlines: string[];
  angles: string[];
};

/**
 * The one generation call: extraction, copy, block composition, art
 * direction and the design brief, with the product photo in view.
 *
 * Extraction and copywriting were briefly two calls, which sent the photo
 * and a long brief twice. They're one again, but extraction still happens
 * first: the response schema puts `factSheet` before every creative field,
 * and Gemini writes properties in schema order — so the copy is generated
 * *from* the fact sheet it just wrote, the same chain a second call gave,
 * at roughly half the input tokens.
 */
export function generateCreative(args: {
  provider: TextGenerationProvider;
  brief: CreativeBrief;
  analysis: ImageAnalysisResult | null;
  image?: string;
  history: CreativeHistory;
  /** The seller's brand: name, tagline and how it talks. */
  brand?: BrandKit | null;
  /** A campaign variant's assigned direction. */
  angle?: CopyAngle;
}) {
  const { provider, brief, analysis, history } = args;

  return provider.generateJSON<CreativeContent>({
    system:
      CREATIVE_DIRECTOR +
      " You can see the product photo. Work in four steps, in the order of the response fields. " +
      "STEP 1 - EXTRACT into factSheet. " +
      EXTRACTION_RULES +
      " Everything after this step may use ONLY facts on your fact sheet — never invent " +
      "specifications, certifications, prices, ratings or claims. Unless the seller's own fields state " +
      "it, never say or imply on any block or badge: bestseller, best-selling, viral, trending, popular, " +
      "in stock, back in stock, limited stock, selling fast, fast/free shipping or delivery, guarantees, " +
      "warranties, discounts or sale prices. " +
      "STEP 2 - FIND THE IDEA. From the primary benefit, emotional hook and differentiators, " +
      "decide the single idea this ad sells, and write a headline that lands it — specific to " +
      "this product, never a generic line that could sell anything. " +
      "STEP 3 - COMPOSE the poster from content blocks and load it with the sheet's strongest " +
      "facts (highest strength first), rephrased into poster language. Every poster carries a " +
      "description, a featureList of 4-6 items and a specGrid of 2-4 pairs, plus the headline and " +
      "button — never skip one, however little the seller wrote; that is what your fact sheet is " +
      "for. Show eight or more separate facts; a poster carrying eight real facts outsells one " +
      "carrying three adjectives. Write every item like a senior copywriter: specific, concrete, " +
      "sensory, no filler. Use a subheadline when the headline needs its promise completed, pick " +
      "an icon that depicts each feature, and put a stated offer in the badge. " +
      "STEP 4 - ART-DIRECT and BRIEF THE DESIGNER. Look at the photo: draw the palette from the " +
      "product's own colours and materials, write the background scene, and rank the poster " +
      "designs from the catalogue below that suit this product and the amount of content you " +
      "composed. Two different products must never receive the same art direction. Keep every " +
      "poster string short enough to read at a glance — long text is truncated.\n\n" +
      "POSTER DESIGN CATALOGUE (id: name — look (scheme; suits)):\n" +
      TEMPLATE_CATALOGUE,
    // A compromise between the two jobs: low enough that extraction stays
    // literal, high enough that copy and art direction vary between runs.
    // The variation token below does most of the varying.
    temperature: 0.7,
    tier: "expert",
    images: args.image ? [args.image] : undefined,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          seller: {
            name: brief.name,
            category: brief.category,
            objective: brief.objective,
            targetPlatform: brief.targetPlatform,
            description: brief.description,
            fields: brief.attributes,
          },
          // What the vision model read off the photo at upload — a head
          // start on the small print, which you can verify in the photo.
          readFromPhoto: analysis
            ? {
                productType: analysis.productType,
                brand: analysis.brandGuess,
                printedText: analysis.detectedText,
                printedClaims: analysis.visibleClaims,
                materials: analysis.materials,
                visualDetails: analysis.visualDetails,
                colours: analysis.detectedColors,
                style: analysis.styleKeywords,
              }
            : null,
        }),
      },
      ...(args.brand && (args.brand.brandName || args.brand.voice || args.brand.tagline)
        ? [
            {
              role: "user" as const,
              content:
                "BRAND GUIDELINES — follow them. " +
                (args.brand.brandName ? `Brand name: "${args.brand.brandName}" (use it as the badge or display name where it fits). ` : "") +
                (args.brand.tagline ? `Brand tagline: "${args.brand.tagline}" (you may use it, verbatim, as a subheadline). ` : "") +
                (args.brand.voice ? `Brand voice — write every line in it: ${args.brand.voice}. ` : "") +
                (args.brand.colors ? "The brand palette is fixed by the brand, so the colours you choose will be overridden; still write the scene to suit it. " : ""),
            },
          ]
        : []),
      ...(args.angle
        ? [
            {
              role: "user" as const,
              content:
                `This ad is one variant in an A/B campaign. Its assigned angle is "${args.angle.label}": ${args.angle.brief} ` +
                "Commit fully to this angle — the other variants cover the other angles.",
            },
          ]
        : []),
      ...(history.templates.length > 0 || history.moods.length > 0
        ? [
            {
              role: "user" as const,
              content:
                `This product has already been advertised ${Math.max(history.templates.length, history.moods.length)} time(s). ` +
                `Previous moods: ${history.moods.join(", ") || "unknown"}. ` +
                `Previous headlines: ${history.headlines.map((h) => `"${h}"`).join(", ") || "unknown"}. ` +
                `Previous copy angles: ${history.angles.join(", ") || "unknown"}. ` +
                `Previous designs: ${history.templates.join(", ") || "unknown"}. ` +
                "Extract the same facts as before, but produce a genuinely different ad: a " +
                "different palette (a different accent hue, not a shade of the same one), a " +
                "different scene, headline and copy angle, different designs in your ranking, " +
                "and lead with different facts. Do not repeat any of the above.",
            },
          ]
        : []),
      {
        // Structured output is close to deterministic for identical input,
        // so without something that actually differs between runs the model
        // returns the same composition every time.
        role: "user" as const,
        content: `Creative variation token (explore a fresh direction): ${Math.random()
          .toString(36)
          .slice(2, 10)}`,
      },
    ],
    schema: creativeSchemaWithBrief(),
  });
}
