import "server-only";
import sharp from "sharp";
import { removeProductBackdrop } from "../images/cutout";
import type { BrandLogo } from "./kit";

const MAX_W = 520;
const MAX_H = 260;

/**
 * Turns an uploaded logo into what designs embed: transparent where the
 * logo has no ink, trimmed, small, PNG — plus its aspect ratio and whether
 * its ink is light or dark.
 *
 * A logo exported on a white (or any plain) background would otherwise land
 * on the ad as a white box, so opaque uploads go through the same backdrop
 * removal product photos do.
 */
export async function processLogo(input: Buffer): Promise<BrandLogo & { png: Buffer }> {
  let image = sharp(input, { density: 300 }).rotate();
  const meta = await image.metadata();

  let buffer = await image.png().toBuffer();
  if (!meta.hasAlpha) {
    const cut = await removeProductBackdrop(`data:image/png;base64,${buffer.toString("base64")}`);
    if (cut.cutoutApplied) buffer = Buffer.from(cut.dataUri.split(",")[1], "base64");
  }

  image = sharp(buffer).trim({ threshold: 1 });
  const png = await image
    .resize({ width: MAX_W, height: MAX_H, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Alpha-weighted mean luminance of the visible ink.
  let lum = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.1) continue;
    lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * a;
    weight += a;
  }
  const tone = weight > 0 && lum / weight > 150 ? "light" : "dark";

  return {
    png,
    src: `data:image/png;base64,${png.toString("base64")}`,
    aspect: info.width / info.height,
    tone,
  };
}
