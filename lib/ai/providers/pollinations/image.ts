import type { ImageGenerationProvider } from "../types";

const BASE_URL = "https://image.pollinations.ai/prompt";
const REQUEST_TIMEOUT_MS = 30_000;
/** Free tier: one image per ~45 s per IP. Wait out that many rate-limit replies. */
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_WAIT_S = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // An API key (enter.pollinations.ai) lifts the free tier's rate limit.
    const key = process.env.POLLINATIONS_API_KEY;
    const headers: Record<string, string> = key ? { authorization: `Bearer ${key}` } : {};

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal, headers });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(`Pollinations request timed out after ${REQUEST_TIMEOUT_MS}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const buffer = Buffer.from(await res.arrayBuffer());
        return { imageUrl: `data:${contentType};base64,${buffer.toString("base64")}`, usage: { costUsd: 0 } };
      }

      const body = await res.text();
      // Parallel jobs (a campaign, a photoshoot) trip the per-IP limit;
      // the reply says how long to wait, so wait rather than fail.
      // 402/429: per-IP free-tier limit. 503: the whole service is at
      // capacity ("retry after 10s"). All three say when to come back.
      if ((res.status === 402 || res.status === 429 || res.status === 503) && attempt < MAX_RATE_LIMIT_RETRIES) {
        const seconds = Number(/retry after (\d+)\s*s/i.exec(body)?.[1] ?? res.headers.get("retry-after") ?? 45);
        if (seconds <= MAX_RETRY_WAIT_S) {
          // Jitter so queued jobs don't all retry in the same second.
          await sleep((seconds + 1 + Math.random() * 4) * 1000);
          continue;
        }
      }
      throw new Error(`Pollinations request failed (${res.status}): ${body}`);
    }
  }
}
