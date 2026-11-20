import type { ChatMessage, TextGenerationProvider } from "../types";
import { callGemini, fetchImageAsBase64 } from "./client";
import { sanitizeSchemaForGemini } from "./sanitizeSchema";
import { GEMINI_TEXT_PRICE_PER_INPUT_TOKEN, GEMINI_TEXT_PRICE_PER_OUTPUT_TOKEN } from "./pricing";

const MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-flash-lite-latest";
/** The model for judgement work. Falls back to MODEL when overloaded (see client.ts). */
const EXPERT_MODEL = process.env.GEMINI_EXPERT_MODEL ?? "gemini-flash-latest";
/**
 * Tokens the model may spend reasoning before it answers. Thinking first is
 * the difference between a first draft and a considered one: it weighs the
 * angle, critiques its headline, then writes.
 */
const EXPERT_THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 2048);

export class GeminiTextGenerationProvider implements TextGenerationProvider {
  readonly id = "gemini";

  async generateJSON<T>(args: {
    system: string;
    messages: ChatMessage[];
    schema: unknown;
    images?: string[];
    temperature?: number;
    tier?: "fast" | "expert";
  }) {
    const expert = args.tier === "expert";
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
        ...(expert ? { thinkingConfig: { thinkingBudget: EXPERT_THINKING_BUDGET } } : {}),
      },
    };

    let result;
    try {
      result = await callGemini(expert ? EXPERT_MODEL : MODEL, body);
    } catch (err) {
      // A model that doesn't take a thinking budget answers 400; the work
      // still matters more than the reasoning, so ask again without it.
      if (!expert || !(err instanceof Error) || !/\(400\)/.test(err.message) || !/thinking/i.test(err.message)) throw err;
      const { thinkingConfig: _unused, ...plainConfig } = body.generationConfig as Record<string, unknown>;
      void _unused;
      result = await callGemini(EXPERT_MODEL, { ...body, generationConfig: plainConfig });
    }
    // With thinking on, the first parts can be thought summaries; the answer
    // is the last text part.
    const parts: Array<{ text?: string; thought?: boolean }> = result.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => p.text && !p.thought).pop()?.text;
    if (!text) throw new Error(`Gemini returned no text content: ${JSON.stringify(result).slice(0, 500)}`);

    const data = JSON.parse(text) as T;
    const inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd =
      inputTokens * GEMINI_TEXT_PRICE_PER_INPUT_TOKEN + outputTokens * GEMINI_TEXT_PRICE_PER_OUTPUT_TOKEN;

    return { data, usage: { inputTokens, outputTokens, costUsd } };
  }
}
