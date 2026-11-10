// Best-effort cost estimates in USD per token, for generation_usage
// tracking. NOT guaranteed current — verify against
// https://ai.google.dev/gemini-api/docs/pricing before using these numbers
// for real billing/margin decisions. Safe to adjust without touching any
// calling code.
export const GEMINI_TEXT_PRICE_PER_INPUT_TOKEN = 0.3 / 1_000_000;
export const GEMINI_TEXT_PRICE_PER_OUTPUT_TOKEN = 2.5 / 1_000_000;

// Nano Banana (gemini-2.5-flash-image) is priced per generated image, not
// per token, at time of writing.
export const GEMINI_IMAGE_PRICE_PER_IMAGE = 0.039;
