import type { ImageAnalysisProvider } from "../types";
import { callGemini, fetchImageAsBase64 } from "./client";
import { sanitizeSchemaForGemini } from "./sanitizeSchema";

const MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-flash-lite-latest";

const ANALYSIS_SCHEMA = sanitizeSchemaForGemini({
  type: "object",
  properties: {
    suggestedCategory: { type: "string" },
    suggestedProductName: { type: "string" },
    detectedColors: { type: "array", items: { type: "string" } },
    detectedText: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    notes: { type: "string" },
  },
  required: ["suggestedCategory", "detectedColors", "confidence"],
});

export class GeminiImageAnalysisProvider implements ImageAnalysisProvider {
  readonly id = "gemini";

  async analyzeImage(args: {
    imageUrl: string;
    hints?: { userProvidedCategory?: string; userProvidedName?: string };
  }) {
    const image = await fetchImageAsBase64(args.imageUrl);

    const prompt =
      "Analyze this product photo for an advertising platform. Identify the product category, " +
      "dominant colors, any visible text on packaging, and your confidence (0-1) in the category guess. " +
      "Be honest about low confidence — do not inflate it. Do not invent specifications or claims, only " +
      "describe what is visibly in the image." +
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
