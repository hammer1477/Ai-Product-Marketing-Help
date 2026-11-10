import type { ImageAnalysisProvider, ImageGenerationProvider, TextGenerationProvider } from "./types";
import { MockTextGenerationProvider } from "./mock/text";
import { MockImageAnalysisProvider } from "./mock/vision";
import { MockImageGenerationProvider } from "./mock/image";

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
    textProvider =
      id === "mock"
        ? new MockTextGenerationProvider()
        : (() => {
            throw new Error(`Unknown or not-yet-implemented AI_TEXT_PROVIDER: "${id}"`);
          })();
  }
  return textProvider;
}

export function getVisionProvider(): ImageAnalysisProvider {
  if (!visionProvider) {
    const id = process.env.AI_VISION_PROVIDER ?? "mock";
    visionProvider =
      id === "mock"
        ? new MockImageAnalysisProvider()
        : (() => {
            throw new Error(`Unknown or not-yet-implemented AI_VISION_PROVIDER: "${id}"`);
          })();
  }
  return visionProvider;
}

export function getImageProvider(): ImageGenerationProvider {
  if (!imageProvider) {
    const id = process.env.AI_IMAGE_PROVIDER ?? "mock";
    imageProvider =
      id === "mock"
        ? new MockImageGenerationProvider()
        : (() => {
            throw new Error(`Unknown or not-yet-implemented AI_IMAGE_PROVIDER: "${id}"`);
          })();
  }
  return imageProvider;
}
