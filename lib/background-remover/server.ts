import "server-only";
import sharp from "sharp";

// Feature 4 (Product Background Remover) — server-side segmentation.
//
// This is background REMOVAL, not generation: every provider here is a
// dedicated matting / salient-object segmentation model. We only ever keep
// the provider's alpha channel and return it as a greyscale mask; the
// browser applies that mask to the user's untouched original pixels. So the
// product's colours, packaging, logos and text can never be redrawn by a
// model — they never pass through one on the way to the final PNG.
//
// Providers (all optional, all keyed by env vars private to this feature):
//   fal      — BiRefNet v2 on fal.ai          BG_REMOVER_FAL_KEY
//   removebg — remove.bg API                  BG_REMOVER_REMOVEBG_KEY
// With neither configured, the client runs BiRefNet in the browser instead.

export type CloudProvider = "fal" | "removebg";

/** The configured cloud provider, or null to segment in the browser. */
export function cloudProvider(): CloudProvider | null {
  const choice = (process.env.BG_REMOVER_PROVIDER ?? "auto").trim().toLowerCase();
  const fal = Boolean(process.env.BG_REMOVER_FAL_KEY);
  const removebg = Boolean(process.env.BG_REMOVER_REMOVEBG_KEY);
  if (choice === "browser") return null;
  if (choice === "fal") return fal ? "fal" : null;
  if (choice === "removebg") return removebg ? "removebg" : null;
  return fal ? "fal" : removebg ? "removebg" : null;
}

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** The client downscales before upload, so this is generous yet under Vercel's 4.5 MB body cap. */
export const MAX_SEGMENT_BYTES = 4 * 1024 * 1024;
const MAX_SEGMENT_SIDE = 4096;

export class SegmentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Server-side validation: real image bytes, an allowed format, sane dimensions. */
export async function validateSegmentInput(file: File): Promise<{ buffer: Buffer; width: number; height: number; mime: string }> {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new SegmentError("Please upload a JPG, PNG or WebP image.", 415);
  }
  if (file.size === 0) throw new SegmentError("The image is empty.");
  if (file.size > MAX_SEGMENT_BYTES) throw new SegmentError("The image is too large to process.", 413);

  const buffer = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new SegmentError("That file isn't a readable image.", 415);
  }
  // Trust the decoded bytes, not the declared MIME type.
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
    throw new SegmentError("Please upload a JPG, PNG or WebP image.", 415);
  }
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (width < 16 || height < 16) throw new SegmentError("The image is too small.");
  if (width > MAX_SEGMENT_SIDE || height > MAX_SEGMENT_SIDE) throw new SegmentError("The image dimensions are too large.", 413);

  return { buffer, width, height, mime: `image/${meta.format}` };
}

async function segmentWithFal(buffer: Buffer, mime: string): Promise<Buffer> {
  const res = await fetch("https://fal.run/fal-ai/birefnet/v2", {
    method: "POST",
    headers: { Authorization: `Key ${process.env.BG_REMOVER_FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: `data:${mime};base64,${buffer.toString("base64")}`,
      operating_resolution: "2048x2048",
      output_format: "png",
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    console.error("[background-remover] fal error", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new SegmentError("The background-removal service failed.", 502);
  }
  const json = (await res.json()) as { image?: { url?: string } };
  if (!json.image?.url) throw new SegmentError("The background-removal service returned no image.", 502);
  const out = await fetch(json.image.url, { signal: AbortSignal.timeout(20_000) });
  if (!out.ok) throw new SegmentError("Couldn't download the processed image.", 502);
  return Buffer.from(await out.arrayBuffer());
}

async function segmentWithRemoveBg(buffer: Buffer, mime: string): Promise<Buffer> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(buffer)], { type: mime }), "product");
  form.append("size", "auto");
  form.append("format", "png");
  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": process.env.BG_REMOVER_REMOVEBG_KEY! },
    body: form,
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    console.error("[background-remover] remove.bg error", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new SegmentError(
      res.status === 402 ? "The background-removal service is out of credits." : "The background-removal service failed.",
      502,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Runs the configured provider and returns a greyscale PNG mask exactly
 * `width` × `height` (255 = product, 0 = background).
 */
export async function segmentToMask(
  provider: CloudProvider,
  input: { buffer: Buffer; width: number; height: number; mime: string },
): Promise<Buffer> {
  const cutout =
    provider === "fal" ? await segmentWithFal(input.buffer, input.mime) : await segmentWithRemoveBg(input.buffer, input.mime);

  const image = sharp(cutout);
  const meta = await image.metadata();
  const channel = meta.hasAlpha ? image.extractChannel("alpha") : image.greyscale();
  return channel
    .resize(input.width, input.height, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("b-w")
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/** Validates a finished cutout the browser uploaded to the asset library. */
export async function inspectCutoutPng(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  if (meta.format !== "png") throw new SegmentError("Saved cutouts must be PNG files.");
  if (!meta.hasAlpha) throw new SegmentError("The PNG has no transparency channel.");
  if (!meta.width || !meta.height) throw new SegmentError("The PNG has no dimensions.");
  return { width: meta.width, height: meta.height };
}
