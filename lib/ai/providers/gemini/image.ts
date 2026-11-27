import type { ImageGenerationProvider } from "../types";
import { callGemini, fetchImageAsBase64 } from "./client";
import { GEMINI_IMAGE_PRICE_PER_IMAGE } from "./pricing";

// "Nano Banana" — supports both text-to-image and image-to-image editing,
// which is what lets premium-photo generation preserve the real product's
// identity rather than inventing a new one.
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";

/** The nearest aspect ratio Gemini supports. */
function aspectRatio(width: number, height: number): string {
  const options: Array<[string, number]> = [["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["9:16", 9 / 16], ["16:9", 16 / 9], ["4:3", 4 / 3], ["3:2", 1.5], ["2:3", 2 / 3]];
  const r = width / Math.max(1, height);
  return options.reduce((best, o) => (Math.abs(Math.log(o[1] / r)) < Math.abs(Math.log(best[1] / r)) ? o : best))[0];
}

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

    // Ask for the shape we need; Gemini otherwise answers square.
    const result = await callGemini(MODEL, {
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspectRatio(args.width, args.height) } },
    });

    const responseParts = result.candidates?.[0]?.content?.parts ?? [];
    const imagePart = responseParts.find((p: any) => p.inlineData?.data);

    if (!imagePart) {
      throw new Error(`Gemini returned no image data: ${JSON.stringify(result).slice(0, 500)}`);
    }

    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    return { imageUrl, usage: { costUsd: GEMINI_IMAGE_PRICE_PER_IMAGE } };
  }
}
