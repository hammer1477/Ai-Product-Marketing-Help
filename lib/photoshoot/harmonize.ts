import "server-only";
import sharp from "sharp";
import { callGemini } from "../ai/providers/gemini/client";
import type { ShotResult } from "./composite";

// The realism pass: turns a composite into one photograph.
//
// A composite always has tells — light that doesn't fall the way the set's
// light falls, a shadow that's a little too clean, two kinds of grain. An
// image-editing model is very good at erasing exactly those tells, and very
// bad at leaving a product alone: it redraws labels, nudges shapes, shifts
// colours. So it gets the composite, does the photographic part, and then
// the real product's pixels are put back on top of its result:
//
//   - outside the product: the model's set, shadows, spill and grade
//   - the product itself: the original pixels, only re-lit by the model's
//     *soft* lighting (a heavily blurred luminance ratio), so the label,
//     edges and colours stay exactly the seller's
//
// If the model moved or resized the product, its version is thrown away and
// the plain composite stands — a slightly-less-real shot beats a wrong one.

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";

const PROMPT =
  "This is a product photo composite. Turn it into a single, real, unretouched photograph taken with a camera in this exact scene. " +
  "Keep the product EXACTLY where it is, at exactly the same size, with exactly the same shape, colours, label, text and details — " +
  "do not redraw, move, resize, crop, duplicate or replace it, and do not add any other product. " +
  "Only fix what gives away a composite: make the light on the product match the direction, softness and colour of the scene's light; " +
  "add a natural contact shadow and a soft cast shadow where it rests on the surface; add a subtle reflection if the surface is glossy; " +
  "make depth of field, colour grade, contrast and film grain consistent across the whole frame. " +
  "No text, no logos, no watermarks, no extra objects, no people.";

function aspectFor(W: number, H: number): string {
  const r = W / H;
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (Math.abs(r - 0.8) < 0.05) return "4:5";
  if (Math.abs(r - 9 / 16) < 0.05) return "9:16";
  if (Math.abs(r - 16 / 9) < 0.05) return "16:9";
  return r > 1 ? "16:9" : "9:16";
}

/** After a quota refusal, skip the pass for a while instead of paying the round trip every shot. */
let pausedUntil = 0;

export function realismEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.PHOTOSHOOT_REALISM !== "off" && Date.now() > pausedUntil;
}

/** The realism-passed shot, or null when the pass is off, fails, or drifted. */
export async function harmonizeShot(shot: ShotResult, W: number, H: number): Promise<Buffer | null> {
  if (!realismEnabled()) return null;

  let edited: Buffer;
  try {
    const result = await callGemini(MODEL, {
      contents: [
        {
          role: "user",
          parts: [{ text: PROMPT }, { inlineData: { mimeType: "image/jpeg", data: shot.jpeg.toString("base64") } }],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspectFor(W, H) } },
    }, { retries: 1 });
    const part = (result.candidates?.[0]?.content?.parts ?? []).find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
    if (!part) return null;
    edited = await sharp(Buffer.from(part.inlineData.data, "base64")).resize(W, H, { fit: "fill" }).removeAlpha().toBuffer();
  } catch (err) {
    if (/(429)/.test((err as Error).message)) pausedUntil = Date.now() + 15 * 60 * 1000;
    console.warn("Photoshoot realism pass failed, keeping the composite:", (err as Error).message.slice(0, 200));
    return null;
  }

  const { png, left, top, width: pw, height: ph } = shot.placement;
  // Clip the product box to the canvas (it always is, but be safe).
  const w = Math.min(pw, W - left);
  const h = Math.min(ph, H - top);
  if (w < 8 || h < 8) return null;

  const product = await sharp(png).extract({ left: 0, top: 0, width: w, height: h }).ensureAlpha().raw().toBuffer();
  const [before, after] = await Promise.all([
    sharp(shot.jpeg).extract({ left, top, width: w, height: h }).removeAlpha().raw().toBuffer(),
    sharp(edited).extract({ left, top, width: w, height: h }).removeAlpha().raw().toBuffer(),
  ]);

  // Drift check: inside the product's silhouette, did the model keep it
  // where it was? Compared on luminance, ignoring the re-lighting it was
  // asked to do by normalising each side's mean first.
  let n = 0;
  let meanB = 0;
  let meanA = 0;
  const lum = (buf: Buffer, i: number) => 0.299 * buf[i * 3] + 0.587 * buf[i * 3 + 1] + 0.114 * buf[i * 3 + 2];
  for (let i = 0; i < w * h; i++) {
    if (product[i * 4 + 3] < 200) continue;
    meanB += lum(before, i);
    meanA += lum(after, i);
    n++;
  }
  if (n < 100) return null;
  meanB /= n;
  meanA /= n;
  let diff = 0;
  for (let i = 0; i < w * h; i++) {
    if (product[i * 4 + 3] < 200) continue;
    diff += Math.abs(lum(before, i) - meanB - (lum(after, i) - meanA));
  }
  diff /= n;
  if (diff > 34) {
    console.warn(`Photoshoot realism pass moved the product (drift ${diff.toFixed(1)}), keeping the composite`);
    return null;
  }

  // Soft re-light: the ratio of the model's lighting to ours, blurred hard
  // enough that only broad light and shade survive — never a label edge.
  const sigma = Math.max(6, Math.round(Math.min(w, h) / 10));
  const [softBefore, softAfter] = await Promise.all(
    [before, after].map((buf) =>
      sharp(buf, { raw: { width: w, height: h, channels: 3 } }).greyscale().blur(sigma).raw().toBuffer(),
    ),
  );
  const restored = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const ratio = Math.min(1.25, Math.max(0.78, (softAfter[i] + 4) / (softBefore[i] + 4)));
    for (let c = 0; c < 3; c++) restored[i * 4 + c] = Math.min(255, Math.round(product[i * 4 + c] * ratio));
    restored[i * 4 + 3] = product[i * 4 + 3];
  }
  // Feather the edge in by a pixel or two so the model's rim light and
  // contact shadow wrap the product rather than being cut off by it.
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = restored[i * 4 + 3];
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .erode(2)
    .extractChannel(0)
    .blur(1.2)
    .raw()
    .toBuffer();
  for (let i = 0; i < w * h; i++) restored[i * 4 + 3] = Math.min(restored[i * 4 + 3], soft[i] ?? 0);

  const overlay = await sharp(restored, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const grain = await sharp({ create: { width: w, height: h, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 7 } } })
    .png()
    .toBuffer();
  const productWithGrain = await sharp(overlay)
    .composite([
      { input: grain, blend: "overlay" },
      { input: overlay, blend: "dest-in" },
    ])
    .png()
    .toBuffer();

  return sharp(edited)
    .composite([{ input: productWithGrain, left, top }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
