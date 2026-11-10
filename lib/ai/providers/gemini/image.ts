import type { ImageGenerationProvider } from "../types";
import { callGemini, fetchImageAsBase64 } from "./client";
import { GEMINI_IMAGE_PRICE_PER_IMAGE } from "./pricing";

// "Nano Banana" — supports both text-to-image and image-to-image editing,
// which is what lets premium-photo generation preserve the real product's
// identity rather than inventing a new one.
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";

export class GeminiImageGenerationProvider implements ImageGenerationProvider {
  readonly id = "gemini";

  async generate(args: {
    prompt: string;
    referenceImageUrl?: string;
    mode: "text-to-image" | "image-to-image" | "inpaint";
    width: number;
    height: number;
  }) {
    const parts: unknown[] = [{ text: args.prompt }];

    if (args.referenceImageUrl) {
      const image = await fetchImageAsBase64(args.referenceImageUrl);
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }

    const result = await callGemini(MODEL, { contents: [{ role: "user", parts }] });

    const responseParts = result.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find((p: any) => p.inlineData?.data);

    if (!imagePart) {
      throw new Error(`Gemini returned no image data: ${JSON.stringify(result).slice(0, 500)}`);
    }

    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { imageUrl, usage: { costUsd: GEMINI_IMAGE_PRICE_PER_IMAGE } };
  }
}
