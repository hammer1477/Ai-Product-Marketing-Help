import type { ChatMessage, TextGenerationProvider } from "../types";
import { callGemini } from "./client";
import { sanitizeSchemaForGemini } from "./sanitizeSchema";
import { GEMINI_TEXT_PRICE_PER_INPUT_TOKEN, GEMINI_TEXT_PRICE_PER_OUTPUT_TOKEN } from "./pricing";

const MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-flash-lite-latest";

export class GeminiTextGenerationProvider implements TextGenerationProvider {
  readonly id = "gemini";

  async generateJSON<T>(args: { system: string; messages: ChatMessage[]; schema: unknown }) {
    const body = {
      systemInstruction: { parts: [{ text: args.system }] },
      contents: args.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: sanitizeSchemaForGemini(args.schema),
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
