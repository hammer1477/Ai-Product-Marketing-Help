import "server-only";
import sharp, { type OverlayOptions } from "sharp";

// Places the real product cutout into a generated scene.
//
// The product pixels are never generated: the scene is made empty, and the
// real cutout is layered in. What makes it read as *photographed there*
// rather than pasted on is the integration, all done here:
//
//   - the product takes on a little of the scene's colour and brightness
//   - a soft light wrap bleeds the scene's light over the product's edges
//   - shadows are cast from the product's own silhouette, away from the
//     side the scene is lit from, plus a tight contact shadow at its base
//   - glossy sets (marble, water, lacquer) get a faded reflection
//   - a gentle vignette and depth blur on the set make the product the
//     sharpest, brightest thing in frame

export type Framing = "hero" | "closeup" | "thirds";

function buffer(dataUri: string): Buffer {
  return Buffer.from(dataUri.replace(/^data:[^;]+;base64,/, ""), "base64");
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

type Rgb = { r: number; g: number; b: number };

async function meanColor(img: Buffer, area?: { left: number; top: number; width: number; height: number }): Promise<Rgb> {
  const base = area ? sharp(img).extract(area) : sharp(img);
  const { channels } = await base.stats();
  return { r: channels[0].mean, g: channels[1].mean, b: channels[2].mean };
}

const luma = (c: Rgb) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

/** Where the product goes and how big, by framing and canvas shape. */
function layout(W: number, H: number, framing: Framing, lightFromLeft: boolean) {
  const landscape = W > H;
  const square = W === H;
  const tall = !landscape && !square;
  const size = {
    hero: { h: landscape ? 0.72 : square ? 0.66 : 0.5, w: landscape ? 0.48 : 0.72, base: landscape ? 0.9 : tall ? 0.8 : 0.87 },
    closeup: { h: landscape ? 0.86 : square ? 0.8 : 0.62, w: landscape ? 0.6 : 0.88, base: landscape ? 0.96 : tall ? 0.84 : 0.94 },
    thirds: { h: landscape ? 0.74 : square ? 0.64 : 0.48, w: landscape ? 0.44 : 0.6, base: landscape ? 0.9 : tall ? 0.8 : 0.87 },
  }[framing];
  // Off-centre shots put the product on the shadow side, so the lit side
  // of the set stays open as negative space.
  const cx = framing === "thirds" ? (lightFromLeft ? W * 0.62 : W * 0.38) : W / 2;
  return { maxW: Math.round(W * size.w), maxH: Math.round(H * size.h), baseY: Math.round(H * size.base), cx };
}

/**
 * An overlay cropped to the canvas — sharp refuses overlays that hang off
 * the edge, and wide close-up shadows do.
 */
async function clipped(img: Buffer, left: number, top: number, W: number, H: number): Promise<OverlayOptions | null> {
  const { width = 0, height = 0 } = await sharp(img).metadata();
  const x0 = Math.max(0, Math.round(left));
  const y0 = Math.max(0, Math.round(top));
  const x1 = Math.min(W, Math.round(left) + width);
  const y1 = Math.min(H, Math.round(top) + height);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const input = await sharp(img)
    .extract({ left: x0 - Math.round(left), top: y0 - Math.round(top), width: x1 - x0, height: y1 - y0 })
    .png()
    .toBuffer();
  return { input, left: x0, top: y0 };
}

/** Black silhouette of the product at `opacity`, as RGBA. */
async function silhouette(alpha: Buffer, w: number, h: number, opacity: number): Promise<Buffer> {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = Math.round(alpha[i] * opacity);
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

export async function compositeShot(args: {
  scene: string;
  product: string;
  /** Whether `product` has a transparent background. */
  cutout: boolean;
  width: number;
  height: number;
  framing?: Framing;
  /** The set has a reflective surface. */
  glossy?: boolean;
}): Promise<Buffer> {
  const { width: W, height: H } = args;
  const framing = args.framing ?? "hero";

  // Free image generators stamp a watermark along the bottom edge. Fit the
  // scene slightly taller than the output and crop that strip away.
  const tallH = Math.round(H / 0.92);
  const rawScene = await sharp(buffer(args.scene))
    .resize(W, tallH, { fit: "cover", position: "centre" })
    .extract({ left: 0, top: 0, width: W, height: H })
    .toBuffer();

  // Read the set's light: overall colour, and which side is brighter.
  const half = Math.floor(W / 2);
  const upper = Math.round(H * 0.6);
  const [sceneMean, leftMean, rightMean] = await Promise.all([
    meanColor(rawScene),
    meanColor(rawScene, { left: 0, top: 0, width: half, height: upper }),
    meanColor(rawScene, { left: half, top: 0, width: W - half, height: upper }),
  ]);
  const lightFromLeft = luma(leftMean) >= luma(rightMean);
  const lightBias = clamp(Math.abs(luma(leftMean) - luma(rightMean)) / 40, 0.25, 1);

  // A touch of depth blur on the set so the real product is the sharpest
  // thing in frame.
  const background = await sharp(rawScene).blur(0.9).toBuffer();

  const { maxW, maxH, baseY, cx } = layout(W, H, framing, lightFromLeft);

  // ---- The product ------------------------------------------------------
  let productPng: Buffer;
  if (args.cutout) {
    const resized = await sharp(buffer(args.product))
      .resize(maxW, maxH, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = resized.info;
    const px = resized.data;

    // Colour and exposure match: pull the product a little toward the
    // set's cast and brightness. Gentle — it's still the real product.
    const avg = (sceneMean.r + sceneMean.g + sceneMean.b) / 3 || 1;
    const cast = [sceneMean.r / avg, sceneMean.g / avg, sceneMean.b / avg].map((m) => 1 + 0.14 * (m - 1));
    const exposure = clamp(1 + ((luma(sceneMean) - 135) / 135) * 0.1, 0.9, 1.07);
    for (let i = 0; i < w * h; i++) {
      for (let c = 0; c < 3; c++) px[i * 4 + c] = clamp(Math.round(px[i * 4 + c] * cast[c] * exposure), 0, 255);
    }

    // Light wrap: the set's light, blurred, bleeding over the outer edge.
    const alpha = Buffer.alloc(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = px[i * 4 + 3];
    const ring = Math.max(3, Math.round(Math.min(w, h) * 0.012));
    const eroded = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).erode(ring).extractChannel(0).raw().toBuffer();
    const left = clamp(Math.round(cx - w / 2), 0, Math.max(0, W - w));
    const top = clamp(baseY - h, 0, Math.max(0, H - h));
    const patch = await sharp(rawScene)
      .extract({ left, top, width: Math.min(w, W - left), height: Math.min(h, H - top) })
      .resize(w, h, { fit: "fill" })
      .blur(Math.max(4, ring * 3))
      .removeAlpha()
      .raw()
      .toBuffer();
    for (let i = 0; i < w * h; i++) {
      const edge = Math.max(0, alpha[i] - (eroded[i] ?? 0)) / 255;
      const k = edge * 0.38;
      if (k <= 0) continue;
      for (let c = 0; c < 3; c++) {
        // Screen blend toward the set's light.
        const a = px[i * 4 + c] / 255;
        const b = patch[i * 3 + c] / 255;
        const screen = 1 - (1 - a) * (1 - b);
        px[i * 4 + c] = Math.round(255 * (a + (screen - a) * k));
      }
    }

    productPng = await sharp(px, { raw: { width: w, height: h, channels: 4 } }).sharpen({ sigma: 0.6 }).png().toBuffer();
  } else {
    // Not a cutout: present the photo as a print propped on the set.
    const photo = await sharp(buffer(args.product))
      .resize(Math.round(maxW * 0.85), Math.round(maxH * 0.85), { fit: "inside" })
      .toBuffer({ resolveWithObject: true });
    const border = Math.round(Math.min(photo.info.width, photo.info.height) * 0.035);
    const framed = await sharp(photo.data)
      .extend({ top: border, bottom: border, left: border, right: border, background: "#fbfaf7" })
      .toBuffer({ resolveWithObject: true });
    const r = Math.round(border * 0.6);
    const mask = Buffer.from(
      `<svg width="${framed.info.width}" height="${framed.info.height}"><rect width="100%" height="100%" rx="${r}" fill="#fff"/></svg>`,
    );
    productPng = await sharp(framed.data).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  }

  const meta = await sharp(productPng).metadata();
  const pw = meta.width ?? maxW;
  const ph = meta.height ?? maxH;
  const left = clamp(Math.round(cx - pw / 2), 0, Math.max(0, W - pw));
  const top = clamp(baseY - ph, 0, Math.max(0, H - ph));
  const bottom = top + ph;

  const productAlpha = await sharp(productPng).ensureAlpha().extractChannel(3).raw().toBuffer();
  const layers: OverlayOptions[] = [];
  const place = async (img: Buffer, x: number, y: number) => {
    const overlay = await clipped(img, x, y, W, H);
    if (overlay) layers.push(overlay);
  };

  // ---- Shadows ----------------------------------------------------------
  // Cast shadow: the silhouette laid back along the floor, sheared away
  // from the light, so it peeks out from the product's shadow side.
  const castH = Math.max(10, Math.round(ph * 0.32));
  const dir = lightFromLeft ? 1 : -1;
  const shear = dir * 0.9 * lightBias;
  const flat = await sharp(await silhouette(productAlpha, pw, ph, 0.34 + 0.12 * lightBias))
    .resize(pw, castH, { fit: "fill" })
    .toBuffer();
  const sheared = await sharp(flat)
    .affine([[1, -shear], [0, 1]], { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(Math.max(3, castH * 0.12))
    .png()
    .toBuffer({ resolveWithObject: true });
  const castLeft = Math.round(left + pw / 2 - sheared.info.width / 2 + dir * (sheared.info.width - pw) / 2);
  await place(sheared.data, castLeft, bottom - sheared.info.height);

  // Contact shadow: a squashed silhouette right at the base, plus a soft
  // ambient pool — what keeps the product from floating.
  const contactH = Math.max(8, Math.round(ph * 0.06));
  const contact = await sharp(await silhouette(productAlpha, pw, ph, 0.75))
    .resize(Math.round(pw * 0.98), contactH, { fit: "fill" })
    .blur(Math.max(2, contactH * 0.35))
    .png()
    .toBuffer();
  const pool = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(pw * 0.05)}"/></filter></defs>
      <ellipse cx="${left + pw / 2 + dir * pw * 0.04}" cy="${bottom}" rx="${pw * 0.56}" ry="${Math.max(8, pw * 0.07)}" fill="#000" opacity="0.32" filter="url(#s)"/>
    </svg>`,
  );
  layers.push({ input: pool, left: 0, top: 0 });

  // ---- Reflection -------------------------------------------------------
  if (args.glossy && args.cutout && bottom < H) {
    const reflH = Math.min(Math.round(ph * 0.45), H - bottom);
    if (reflH > 8) {
      const flipped = await sharp(productPng).flip().extract({ left: 0, top: 0, width: pw, height: reflH }).ensureAlpha().raw().toBuffer();
      for (let y = 0; y < reflH; y++) {
        const fade = 0.28 * (1 - y / reflH) ** 1.6;
        for (let x = 0; x < pw; x++) {
          const i = (y * pw + x) * 4 + 3;
          flipped[i] = Math.round(flipped[i] * fade);
        }
      }
      const refl = await sharp(flipped, { raw: { width: pw, height: reflH, channels: 4 } }).blur(1.6).png().toBuffer();
      await place(refl, left, bottom - 2);
    }
  }

  await place(contact, left + Math.round(pw * 0.01), bottom - Math.round(contactH * 0.55));
  await place(productPng, left, top);

  // ---- Finish -----------------------------------------------------------
  const vignette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><radialGradient id="v" cx="50%" cy="48%" r="75%">
        <stop offset="55%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.32"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  );
  layers.push({ input: vignette, left: 0, top: 0 });

  const composed = await sharp(background).composite(layers).toBuffer();
  return sharp(composed)
    .modulate({ saturation: 1.04 })
    .linear(1.03, -3)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
