const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Calls now carry the product photo and return long structured output (a
// full fact sheet), which can run past 30s on a busy day.
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 503]);

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini(model: string, body: unknown): Promise<any> {
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
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new Error(`Gemini API error (${res.status}) for model ${model}: ${text}`);
      }

      return res.json();
    } catch (err) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastError = isAbort
        ? new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms for model ${model}`)
        : (err as Error);
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
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
