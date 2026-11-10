import type { ImageGenerationProvider } from "../types";

const BASE_URL = "https://image.pollinations.ai/prompt";
const REQUEST_TIMEOUT_MS = 30_000;

// Free, no-signup text-to-image via pollinations.ai. Deliberately used only
// for DECORATIVE backgrounds (mood/texture behind the real product photo),
// never for the product photo itself — this service has no image-to-image
// / reference-image editing, so it cannot guarantee product identity is
// preserved. The orchestration engine (lib/orchestration/engine.ts) only
// ever calls this with mode: "text-to-image" for that reason; the real
// uploaded photo is always used as-is for the product image layer.
export class PollinationsImageGenerationProvider implements ImageGenerationProvider {
  readonly id = "pollinations";

  async generate(args: {
    prompt: string;
    referenceImageUrl?: string;
    mode: "text-to-image" | "image-to-image" | "inpaint";
    width: number;
    height: number;
  }) {
    if (args.mode !== "text-to-image" || args.referenceImageUrl) {
      throw new Error(
        "PollinationsImageGenerationProvider only supports text-to-image generation with no reference " +
          "image — it cannot preserve product identity, so it must never be used to edit a real product photo.",
      );
    }

    // Without a seed the service returns the same image for the same
    // prompt, so regenerating a creative produced a byte-identical
    // background every time. A random seed per call is what makes a second
    // generation actually look like a second attempt.
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url =
      `${BASE_URL}/${encodeURIComponent(args.prompt)}` +
      `?width=${args.width}&height=${args.height}&nologo=true&model=flux&seed=${seed}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Pollinations request failed (${res.status}): ${await res.text()}`);
      }

      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await res.arrayBuffer());
      const imageUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

      return { imageUrl, usage: { costUsd: 0 } };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Pollinations request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw err;
    }
  }
}
