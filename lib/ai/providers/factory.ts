import type { ImageAnalysisProvider, ImageGenerationProvider, TextGenerationProvider } from "./types";
import { MockTextGenerationProvider } from "./mock/text";
import { MockImageAnalysisProvider } from "./mock/vision";
import { MockImageGenerationProvider } from "./mock/image";
import { GeminiTextGenerationProvider } from "./gemini/text";
import { GeminiImageAnalysisProvider } from "./gemini/vision";
import { GeminiImageGenerationProvider } from "./gemini/image";
import { PollinationsImageGenerationProvider } from "./pollinations/image";

// Phase 1: provider selection is env-var driven and read once. The
// ai_provider_configs DB table records which provider/model produced each
// generation for audit/cost-tracking — it does not drive runtime selection
// yet (no admin UI in Phase 1; see supabase/migrations/0004_ai_provider_configs.sql).
let textProvider: TextGenerationProvider | null = null;
let visionProvider: ImageAnalysisProvider | null = null;
let imageProvider: ImageGenerationProvider | null = null;

export function getTextProvider(): TextGenerationProvider {
  if (!textProvider) {
    const id = process.env.AI_TEXT_PROVIDER ?? "mock";
    if (id === "mock") textProvider = new MockTextGenerationProvider();
    else if (id === "gemini") textProvider = new GeminiTextGenerationProvider();
    else throw new Error(`Unknown or not-yet-implemented AI_TEXT_PROVIDER: "${id}"`);
  }
  return textProvider;
}

export function getVisionProvider(): ImageAnalysisProvider {
  if (!visionProvider) {
    const id = process.env.AI_VISION_PROVIDER ?? "mock";
    if (id === "mock") visionProvider = new MockImageAnalysisProvider();
    else if (id === "gemini") visionProvider = new GeminiImageAnalysisProvider();
    else throw new Error(`Unknown or not-yet-implemented AI_VISION_PROVIDER: "${id}"`);
  }
  return visionProvider;
}

export function getImageProvider(): ImageGenerationProvider {
  if (!imageProvider) {
    const id = process.env.AI_IMAGE_PROVIDER ?? "mock";
    if (id === "mock") imageProvider = new MockImageGenerationProvider();
    // Gemini ("Nano Banana") first; on a refusal or failure — quota, outage —
    // the free Flux model makes the scene so a generation never fails on it.
    else if (id === "gemini") imageProvider = new FallbackImageProvider(new GeminiImageGenerationProvider(), new PollinationsImageGenerationProvider());
    else if (id === "pollinations") imageProvider = new PollinationsImageGenerationProvider();
    else throw new Error(`Unknown or not-yet-implemented AI_IMAGE_PROVIDER: "${id}"`);
  }
  return imageProvider;
}

class FallbackImageProvider implements ImageGenerationProvider {
  readonly id: string;
  /** After a refusal, go straight to the fallback for a while. */
  private pausedUntil = 0;
  constructor(
    private primary: ImageGenerationProvider,
    private fallback: ImageGenerationProvider,
  ) {
    this.id = primary.id;
  }
  async generate(args: Parameters<ImageGenerationProvider["generate"]>[0]) {
    // The fallback only does text-to-image; anything else must use the primary.
    const canFallBack = args.mode === "text-to-image" && !args.referenceImageUrl;
    if (canFallBack && Date.now() < this.pausedUntil) return this.fallback.generate(args);
    try {
      return await this.primary.generate(args);
    } catch (err) {
      if (!canFallBack) throw err;
      if (/(429)/.test((err as Error).message)) this.pausedUntil = Date.now() + 15 * 60 * 1000;
      console.warn(`Image provider ${this.primary.id} failed, using ${this.fallback.id}:`, (err as Error).message.slice(0, 200));
      return this.fallback.generate(args);
    }
  }
}
