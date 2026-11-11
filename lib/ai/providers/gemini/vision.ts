import type { ImageAnalysisProvider } from "../types";
import { callGemini, fetchImageAsBase64 } from "./client";
import { sanitizeSchemaForGemini } from "./sanitizeSchema";

const MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-flash-lite-latest";

const list = (description: string) => ({ type: "array", items: { type: "string" }, description });

const ANALYSIS_SCHEMA = sanitizeSchemaForGemini({
  type: "object",
  properties: {
    productType: { type: "string", description: "What the product is, in a few words, e.g. 'over-ear wireless headphones'." },
    suggestedCategory: { type: "string" },
    suggestedProductName: { type: "string", description: "Only if legibly printed; otherwise omit." },
    brandGuess: { type: "string", description: "Brand name only if legibly printed on product or packaging." },
    detectedText: list("Every legible piece of text on the product or packaging, verbatim, one entry per line or label."),
    visibleClaims: list(
      "Claims, specs and quantities printed on the product, verbatim — e.g. 'SPF 50', '500 ml', 'Vitamin C 15%', " +
        "'Bluetooth 5.3', 'Vegan', 'Dermatologist tested'. Only what is actually printed.",
    ),
    materials: list("Visible materials and finishes, e.g. 'brushed aluminium', 'frosted glass', 'matte rubber'."),
    visualDetails: list("Form factor and notable design details: shape, closures, controls, textures, what's included in frame."),
    detectedColors: list("Dominant product colours as hex codes, most dominant first."),
    styleKeywords: list("3-5 aesthetic keywords for the product's look, e.g. 'minimal', 'luxury', 'sporty', 'playful'."),
    audienceHint: { type: "string", description: "Who the product appears aimed at, judged from its look only." },
    confidence: { type: "number", description: "0-1 confidence in the category guess. Be honest." },
    notes: { type: "string" },
  },
  propertyOrdering: [
    "productType",
    "suggestedCategory",
    "suggestedProductName",
    "brandGuess",
    "detectedText",
    "visibleClaims",
    "materials",
    "visualDetails",
    "detectedColors",
    "styleKeywords",
    "audienceHint",
    "confidence",
    "notes",
  ],
  required: ["productType", "suggestedCategory", "detectedColors", "confidence"],
});

export class GeminiImageAnalysisProvider implements ImageAnalysisProvider {
  readonly id = "gemini";

  async analyzeImage(args: {
    imageUrl: string;
    hints?: { userProvidedCategory?: string; userProvidedName?: string };
  }) {
    const image = await fetchImageAsBase64(args.imageUrl);

    const prompt =
      "Analyze this product photo for an advertising platform. Your output is the evidence an ad " +
      "copywriter will rely on, so be thorough and exact. Read every legible word on the product and " +
      "packaging — zoom in mentally on small print, labels, embossing and screens — and transcribe it " +
      "verbatim. Separate out printed claims, specs and quantities. Describe materials, finishes, form " +
      "and design details you can actually see. Identify the category and give an honest confidence " +
      "(0-1) — do not inflate it. Never invent specifications, claims or text that are not visible." +
      (args.hints?.userProvidedName ? ` The seller calls this product "${args.hints.userProvidedName}".` : "") +
      (args.hints?.userProvidedCategory
        ? ` The seller categorized this as "${args.hints.userProvidedCategory}" — you may agree or disagree.`
        : "");

    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
      },
    };

    const result = await callGemini(MODEL, body);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Gemini returned no analysis content: ${JSON.stringify(result).slice(0, 500)}`);

    const data = JSON.parse(text);
    const inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
    // Vision calls are priced the same per-token as text on this model.
    const costUsd = inputTokens * (0.3 / 1_000_000) + outputTokens * (2.5 / 1_000_000);

    return { data, usage: { costUsd } };
  }
}
