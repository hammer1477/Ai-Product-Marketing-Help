import type { ImageGenerationProvider } from "../types";
import { mockDelay } from "./delay";

// 1x1 transparent PNG — a deliberately trivial but *valid* raster image, so
// the full pipeline (schema -> Satori <img> -> resvg) can be exercised
// end-to-end without a real image-generation provider configured.
const PLACEHOLDER_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAWJDPpUAAAAASUVORK5CYII=";

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly id = "mock";

  async generate(args: {
    prompt: string;
    referenceImageUrl?: string;
    mode: "text-to-image" | "image-to-image" | "inpaint";
    width: number;
    height: number;
    preserveSubjectMask?: string;
  }) {
    await mockDelay(400, 900);

    // image-to-image/inpaint: return the reference unchanged, since a real
    // provider's job here is to preserve product identity — the mock's job
    // is just to prove the pipeline wires through correctly end-to-end.
    const imageUrl = args.referenceImageUrl ?? PLACEHOLDER_IMAGE_DATA_URI;

    return { imageUrl, usage: { costUsd: 0 } };
  }
}
