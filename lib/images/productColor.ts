import "server-only";
import sharp from "sharp";
import { toHex } from "../orchestration/color";

// The product's own colour, measured — not guessed.
//
// The art director (a language model) picks the palette by looking at the
// photo, and it's inconsistent: the same strawberry cake came back red,
// pink and gold on three runs. The ad's colour family should be the
// product's, every time, so it's measured from the product's pixels and
// handed to the model as a fixed point (and enforced after it answers).

export type ProductColor = {
  /** The dominant colour of the product's colourful parts. */
  hex: string;
  /** A plain colour name, for the prompt: "red", "teal". */
  name: string;
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function nameFor(hue: number, l: number): string {
  if (hue >= 345 || hue < 12) return l > 0.7 ? "pink" : "red";
  if (hue < 38) return l < 0.4 ? "brown" : "orange";
  if (hue < 52) return l < 0.45 ? "brown" : "gold";
  if (hue < 68) return "yellow";
  if (hue < 95) return "lime green";
  if (hue < 160) return "green";
  if (hue < 185) return "teal";
  if (hue < 205) return "cyan";
  if (hue < 245) return "blue";
  if (hue < 275) return "indigo";
  if (hue < 300) return "purple";
  if (hue < 330) return "magenta";
  return l > 0.65 ? "pink" : "crimson";
}

const BINS = 24;

/**
 * The dominant hue family among the product's colourful pixels. Pale,
 * dark and grey pixels (cream, crumb, shadows, a white bottle) don't vote,
 * so a strawberry cake reads as its strawberries. Null when the product is
 * essentially neutral — then the art director chooses freely.
 */
export async function measureProductColor(dataUri: string, isCutout: boolean): Promise<ProductColor | null> {
  try {
    const input = Buffer.from(dataUri.replace(/^data:[^;]+;base64,/, ""), "base64");
    let img = sharp(input).rotate();
    if (!isCutout) {
      // No transparency to tell product from backdrop: read the middle.
      const meta = await img.metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (w > 10 && h > 10) {
        img = sharp(await img.extract({ left: Math.round(w * 0.2), top: Math.round(h * 0.2), width: Math.round(w * 0.6), height: Math.round(h * 0.6) }).toBuffer());
      }
    }
    const { data, info } = await img.resize(96, 96, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const weights = new Array<number>(BINS).fill(0);
    const sums = Array.from({ length: BINS }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
    let opaque = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      if (data[i * 4 + 3] < 200) continue;
      opaque++;
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      if (s < 0.28 || l < 0.14 || l > 0.9) continue;
      // Saturation counts twice: a large pale cream area must not outvote
      // smaller vivid strawberries.
      const w = s * s * (1 - Math.abs(l - 0.5) * 1.6);
      if (w <= 0) continue;
      const bin = Math.floor(h / (360 / BINS)) % BINS;
      weights[bin] += w;
      sums[bin].r += r * w;
      sums[bin].g += g * w;
      sums[bin].b += b * w;
      sums[bin].w += w;
    }
    if (opaque === 0) return null;

    // Smooth across neighbouring bins so a hue on a bin edge isn't split.
    const smooth = weights.map((w, i) => w + 0.5 * (weights[(i + BINS - 1) % BINS] + weights[(i + 1) % BINS]));
    let best = 0;
    for (let i = 1; i < BINS; i++) if (smooth[i] > smooth[best]) best = i;
    const total = weights.reduce((a, b) => a + b, 0);
    // Too little colour overall: a neutral product.
    if (total / opaque < 0.05) return null;

    const pick = [best - 1, best, best + 1].map((i) => sums[(i + BINS) % BINS]);
    const w = pick.reduce((a, p) => a + p.w, 0);
    if (w <= 0) return null;
    const rgb = { r: pick.reduce((a, p) => a + p.r, 0) / w, g: pick.reduce((a, p) => a + p.g, 0) / w, b: pick.reduce((a, p) => a + p.b, 0) / w };
    const [h, , l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { hex: toHex(rgb), name: nameFor(h, l) };
  } catch {
    return null;
  }
}
