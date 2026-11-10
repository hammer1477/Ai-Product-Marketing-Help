import sharp from "sharp";

// Removes the flat studio backdrop from a product photo so the product can
// sit directly in a generated scene.
//
// Why this exists: the real uploaded photo is non-negotiable (product
// identity must never depend on an AI model preserving it), but almost
// every e-commerce product photo arrives on a plain white sweep. Dropping
// that rectangle onto a cinematic background is what made the output read
// as "two pieces glued together" — a nice scene, plus a pale box with a
// product floating in it. Cutting the backdrop away is what fuses them.
//
// This is deliberately a *conservative* flood fill, not a learned matting
// model: it only removes background that is connected to the image border
// and close in colour to it. A product photographed in a real environment
// (busy background, gradient, no clear border colour) is left untouched
// rather than mangled — a clean uncut photo beats a hole punched through
// the product.

/** Max dimension we process at; larger inputs are downscaled first for speed. */
const MAX_DIMENSION = 1400;

/** Colour distance (0-255 space) still considered "the same backdrop". */
const TOLERANCE = 34;

/** Beyond TOLERANCE, pixels fade out to this multiple instead of hard-cutting. */
const FEATHER_MULTIPLIER = 2.1;

/**
 * Corners must agree within this distance for the photo to count as
 * "shot on a sweep". Disagreeing corners mean a real environment.
 */
const CORNER_AGREEMENT = 42;

/**
 * A backdrop this dark is more likely to be part of the product/scene than
 * a studio sweep, so we only cut light-to-mid backdrops.
 */
const MIN_BACKDROP_LUMA = 115;

function colourDistance(
  data: Buffer,
  indexA: number,
  r: number,
  g: number,
  b: number,
): number {
  const dr = data[indexA] - r;
  const dg = data[indexA + 1] - g;
  const db = data[indexA + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

type Sample = { r: number; g: number; b: number };

function sampleAt(data: Buffer, width: number, x: number, y: number): Sample {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function averageSamples(samples: Sample[]): Sample {
  const total = samples.reduce(
    (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b }),
    { r: 0, g: 0, b: 0 },
  );
  return {
    r: total.r / samples.length,
    g: total.g / samples.length,
    b: total.b / samples.length,
  };
}

function distanceBetween(a: Sample, b: Sample): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export type CutoutResult = {
  /** PNG data URI — transparent where the backdrop was, original otherwise. */
  dataUri: string;
  /** False when the photo didn't look like a studio shot and was left as-is. */
  cutoutApplied: boolean;
  /**
   * Pixel dimensions of the returned image. Templates need these to know
   * where the product actually lands inside a `contain` slot — without
   * them the contact shadow is drawn at the slot's bottom edge and the
   * product appears to hover above its own shadow.
   */
  width: number;
  height: number;
};

async function dimensionsOf(dataUri: string): Promise<{ width: number; height: number }> {
  const buffer = Buffer.from(dataUri.replace(/^data:[^;]+;base64,/, ""), "base64");
  const meta = await sharp(buffer).metadata();
  return { width: meta.width ?? 1, height: meta.height ?? 1 };
}

export async function removeProductBackdrop(imageDataUri: string): Promise<CutoutResult> {
  const base64 = imageDataUri.replace(/^data:[^;]+;base64,/, "");
  const inputBuffer = Buffer.from(base64, "base64");

  const pipeline = sharp(inputBuffer).rotate();
  const metadata = await pipeline.metadata();
  const needsResize =
    (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;

  const { data, info } = await (needsResize
    ? pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    : pipeline
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  // Decide whether this is a studio sweep at all. Sample a small patch at
  // each corner (single pixels are too noisy — JPEG artefacts alone can
  // shift one by 20).
  const inset = Math.max(2, Math.round(Math.min(width, height) * 0.015));
  const corners = [
    averageSamples([
      sampleAt(data, width, inset, inset),
      sampleAt(data, width, inset * 2, inset),
      sampleAt(data, width, inset, inset * 2),
    ]),
    averageSamples([
      sampleAt(data, width, width - 1 - inset, inset),
      sampleAt(data, width, width - 1 - inset * 2, inset),
      sampleAt(data, width, width - 1 - inset, inset * 2),
    ]),
    averageSamples([
      sampleAt(data, width, inset, height - 1 - inset),
      sampleAt(data, width, inset * 2, height - 1 - inset),
      sampleAt(data, width, inset, height - 1 - inset * 2),
    ]),
    averageSamples([
      sampleAt(data, width, width - 1 - inset, height - 1 - inset),
      sampleAt(data, width, width - 1 - inset * 2, height - 1 - inset),
      sampleAt(data, width, width - 1 - inset, height - 1 - inset * 2),
    ]),
  ];

  const backdrop = averageSamples(corners);
  const cornersAgree = corners.every((c) => distanceBetween(c, backdrop) <= CORNER_AGREEMENT);
  const luma = 0.299 * backdrop.r + 0.587 * backdrop.g + 0.114 * backdrop.b;

  if (!cornersAgree || luma < MIN_BACKDROP_LUMA) {
    return { dataUri: imageDataUri, cutoutApplied: false, width, height };
  }

  // Flood fill inward from every border pixel. Only backdrop *connected to
  // the edge* is removed, so a white product label in the middle of the
  // frame survives even though it matches the backdrop colour.
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  const pushIfUnvisited = (x: number, y: number) => {
    const p = y * width + x;
    if (!visited[p]) {
      visited[p] = 1;
      stack.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    pushIfUnvisited(x, 0);
    pushIfUnvisited(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfUnvisited(0, y);
    pushIfUnvisited(width - 1, y);
  }

  const featherLimit = TOLERANCE * FEATHER_MULTIPLIER;
  let removedPixels = 0;

  while (stack.length > 0) {
    const p = stack.pop()!;
    const i = p * 4;
    const distance = colourDistance(data, i, backdrop.r, backdrop.g, backdrop.b);

    if (distance > featherLimit) continue;

    if (distance <= TOLERANCE) {
      data[i + 3] = 0;
      removedPixels++;
    } else {
      // Edge band: fade out proportionally so the cutout doesn't get a
      // hard jagged border against the scene behind it.
      const t = (distance - TOLERANCE) / (featherLimit - TOLERANCE);
      data[i + 3] = Math.round(255 * t);
      // Don't spread through a partially-opaque pixel — that's the product
      // edge, and continuing would eat into the product itself.
      continue;
    }

    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) pushIfUnvisited(x - 1, y);
    if (x < width - 1) pushIfUnvisited(x + 1, y);
    if (y > 0) pushIfUnvisited(x, y - 1);
    if (y < height - 1) pushIfUnvisited(x, y + 1);
  }

  // If barely anything came off, the fill found no real backdrop — return
  // the original rather than a near-identical re-encode.
  const removedRatio = removedPixels / (width * height);
  if (removedRatio < 0.04) {
    return { dataUri: imageDataUri, cutoutApplied: false, width, height };
  }

  // If almost everything came off, the "backdrop" was the product. Bail.
  if (removedRatio > 0.97) {
    return { dataUri: imageDataUri, cutoutApplied: false, width, height };
  }

  const png = await sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return {
    dataUri: `data:image/png;base64,${png.toString("base64")}`,
    cutoutApplied: true,
    width,
    height,
  };
}

/**
 * Trims fully-transparent margins so the product fills its slot instead of
 * being padded by whatever empty sweep surrounded it in the original photo.
 * Safe to call on a non-cutout image — it's a no-op without transparency.
 */
export async function trimTransparentEdges(
  pngDataUri: string,
): Promise<{ dataUri: string; width: number; height: number }> {
  const base64 = pngDataUri.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  try {
    const { data, info } = await sharp(buffer)
      .trim({ threshold: 1 })
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      dataUri: `data:image/png;base64,${data.toString("base64")}`,
      width: info.width,
      height: info.height,
    };
  } catch {
    // sharp throws if trimming would consume the entire image.
    return { dataUri: pngDataUri, ...(await dimensionsOf(pngDataUri)) };
  }
}
