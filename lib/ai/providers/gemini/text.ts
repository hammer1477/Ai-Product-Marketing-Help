import type { ChatMessage, TextGenerationProvider } from "../types";
import { callGemini, fetchImageAsBase64 } from "./client";
import { sanitizeSchemaForGemini } from "./sanitizeSchema";
import { GEMINI_TEXT_PRICE_PER_INPUT_TOKEN, GEMINI_TEXT_PRICE_PER_OUTPUT_TOKEN } from "./pricing";

const MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-flash-lite-latest";

export class GeminiTextGenerationProvider implements TextGenerationProvider {
  readonly id = "gemini";

  async generateJSON<T>(args: { system: string; messages: ChatMessage[]; schema: unknown; images?: string[]; temperature?: number }) {
    // Images ride on the first user turn, so the model reads the product
    // brief with the product in front of it.
    const imageParts = await Promise.all(
      (args.images ?? []).map(async (url) => {
        const image = await fetchImageAsBase64(url);
        return { inlineData: { mimeType: image.mimeType, data: image.data } };
      }),
    );
    const firstUser = args.messages.findIndex((m) => m.role === "user");

    const body = {
      systemInstruction: { parts: [{ text: args.system }] },
      contents: args.messages.map((m, i) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: i === firstUser ? [...imageParts, { text: m.content }] : [{ text: m.content }],
      })),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: sanitizeSchemaForGemini(args.schema),
        ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      },
    };

    const result = await callGemini(MODEL, body);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Gemini returned no text content: ${JSON.stringify(result).slice(0, 500)}`);

    const data = JSON.parse(text) as T;
    const inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd =
      inputTokens * GEMINI_TEXT_PRICE_PER_INPUT_TOKEN + outputTokens * GEMINI_TEXT_PRICE_PER_OUTPUT_TOKEN;

    return { data, usage: { inputTokens, outputTokens, costUsd } };
  }
}
