const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Calls carry the product photo and return long structured output — a full
// campaign plan is several thousand tokens — which can run past 45s.
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 503]);
/** Backoff before retry n (ms): overload spikes last seconds, not milliseconds. */
const BACKOFF_MS = [2_000, 5_000, 10_000];

/**
 * When a model stays overloaded ("high demand" 503s), the next model up
 * usually isn't. One attempt on it beats refunding the user.
 */
const FALLBACK_MODEL: Record<string, string> = {
  "gemini-flash-lite-latest": "gemini-flash-latest",
};

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini(model: string, body: unknown): Promise<any> {
  try {
    return await callModel(model, body);
  } catch (err) {
    const fallback = FALLBACK_MODEL[model];
    if (fallback && err instanceof Error && /\((429|500|503)\)/.test(err.message)) {
      console.warn(`Gemini ${model} unavailable, falling back to ${fallback}`);
      return callModel(fallback, body);
    }
    throw err;
  }
}

async function callModel(model: string, body: unknown): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/models/${model}:generateContent?key=${getApiKey()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          lastError = new Error(`Gemini API error (${res.status}) for model ${model}: ${text}`);
          await sleep(BACKOFF_MS[attempt] + Math.random() * 1000);
          continue;
        }
        // Not retryable (bad request, auth): fail now rather than retry below.
        throw Object.assign(new Error(`Gemini API error (${res.status}) for model ${model}: ${text}`), { final: true });
      }

      return res.json();
    } catch (err) {
      clearTimeout(timeout);
      if ((err as { final?: boolean }).final) throw err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastError = isAbort
        ? new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms for model ${model}`)
        : (err as Error);
      if (attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS[attempt] + Math.random() * 1000);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Gemini request failed for model ${model}`);
}

export async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  if (url.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(url);
    if (!match) throw new Error(`Malformed data URI: ${url.slice(0, 40)}...`);
    return { mimeType: match[1], data: match[2] };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { mimeType, data: buffer.toString("base64") };
}
