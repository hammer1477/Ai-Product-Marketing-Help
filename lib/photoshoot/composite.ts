import "server-only";
import sharp from "sharp";

// Places the real product cutout into a generated scene.
//
// The product pixels are never touched by a model: the scene is generated
// empty, and the cutout is layered on top with a soft cast shadow and a
// tight contact shadow so it sits on the surface instead of floating.

function buffer(dataUri: string): Buffer {
  return Buffer.from(dataUri.replace(/^data:[^;]+;base64,/, ""), "base64");
}

export async function compositeShot(args: {
  scene: string;
  product: string;
  /** Whether `product` has a transparent background. */
  cutout: boolean;
  width: number;
  height: number;
}): Promise<Buffer> {
  const { width: W, height: H } = args;
  // Free image generators stamp a watermark along the bottom edge. Fit the
  // scene slightly taller than the output and crop that strip away.
  const tall = Math.round(H / 0.92);
  const background = await sharp(buffer(args.scene))
    .resize(W, tall, { fit: "cover", position: "centre" })
    .extract({ left: 0, top: 0, width: W, height: H })
    .toBuffer();

  // Product size: tall enough to be the hero, narrow enough to leave set.
  const landscape = W > H;
  const maxH = Math.round(H * (landscape ? 0.66 : W === H ? 0.6 : 0.46));
  const maxW = Math.round(W * (landscape ? 0.42 : 0.62));
  const resized = sharp(buffer(args.product)).resize(maxW, maxH, { fit: "inside" });

  let productPng: Buffer;
  if (args.cutout) {
    productPng = await resized.png().toBuffer();
  } else {
    // Not a cutout: present the photo as a framed print on the set.
    const photo = await resized.toBuffer({ resolveWithObject: true });
    const r = Math.round(Math.min(photo.info.width, photo.info.height) * 0.06);
    const mask = Buffer.from(
      `<svg width="${photo.info.width}" height="${photo.info.height}"><rect width="100%" height="100%" rx="${r}" fill="#fff"/></svg>`,
    );
    productPng = await sharp(photo.data).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  }
  const meta = await sharp(productPng).metadata();
  const pw = meta.width ?? maxW;
  const ph = meta.height ?? maxH;

  // Resting line: the surface sits in the lower part of the frame.
  const baseY = Math.round(H * (landscape ? 0.88 : 0.84));
  const left = Math.round((W - pw) / 2);
  const top = baseY - ph;

  const castW = Math.round(pw * 1.05);
  const castH = Math.max(12, Math.round(pw * 0.16));
  const contactW = Math.round(pw * 0.8);
  const contactH = Math.max(6, Math.round(pw * 0.05));
  const shadow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(castH * 0.45)}"/></filter>
        <filter id="tight" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.max(2, Math.round(contactH * 0.6))}"/></filter>
      </defs>
      <ellipse cx="${W / 2}" cy="${baseY}" rx="${castW / 2}" ry="${castH / 2}" fill="#000" opacity="0.38" filter="url(#soft)"/>
      <ellipse cx="${W / 2}" cy="${baseY - contactH * 0.2}" rx="${contactW / 2}" ry="${contactH / 2}" fill="#000" opacity="0.55" filter="url(#tight)"/>
    </svg>`,
  );

  return sharp(background)
    .composite([
      { input: shadow, left: 0, top: 0 },
      { input: productPng, left, top: Math.max(0, top) },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
