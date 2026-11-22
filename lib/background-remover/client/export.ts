// Feature 4 — exporting the cutout as a PNG that really carries alpha.

import type { CutoutEngine } from "./engine";

export type ExportOptions = {
  /** "canvas" keeps the original photo's dimensions; "tight" crops to the product. */
  framing: "canvas" | "tight";
  /** Transparent padding around a tight crop, as a fraction of the product's longest side. */
  padding: number;
  /** Longest side cap in px, or null for full original resolution. */
  maxSide: number | null;
};

const PNG_COLOR_TYPE_OFFSET = 25; // byte offset of IHDR colour type in a PNG file

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the PNG."))), "image/png"),
  );
}

/** PNG colour types 4 (grey+alpha) and 6 (RGBA) carry an alpha channel. */
async function hasAlphaChannel(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const type = head[PNG_COLOR_TYPE_OFFSET];
  return type === 4 || type === 6;
}

export async function exportCutout(engine: CutoutEngine, options: ExportOptions): Promise<{ blob: Blob; width: number; height: number }> {
  const full = engine.renderFull();
  let sx = 0,
    sy = 0,
    sw = full.width,
    sh = full.height,
    pad = 0;

  if (options.framing === "tight") {
    const box = engine.contentBounds();
    if (!box) throw new Error("Nothing is left to export — the whole image has been erased.");
    ({ x: sx, y: sy, width: sw, height: sh } = box);
    pad = Math.round(Math.max(sw, sh) * options.padding);
  }

  const naturalW = sw + pad * 2;
  const naturalH = sh + pad * 2;
  const scale = options.maxSide ? Math.min(1, options.maxSide / Math.max(naturalW, naturalH)) : 1;

  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(naturalW * scale));
  out.height = Math.max(1, Math.round(naturalH * scale));
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(full, sx, sy, sw, sh, pad * scale, pad * scale, sw * scale, sh * scale);

  let blob = await toBlob(out);
  if (!(await hasAlphaChannel(blob))) {
    // Some encoders drop alpha when every pixel is opaque. Nudge one corner
    // pixel so the file is guaranteed to be an RGBA PNG.
    const px = ctx.getImageData(0, 0, 1, 1);
    px.data[3] = Math.min(px.data[3], 254);
    ctx.putImageData(px, 0, 0);
    blob = await toBlob(out);
  }
  return { blob, width: out.width, height: out.height };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "My Perfume (final).jpg" → "my-perfume-final" */
export function slugify(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product"
  );
}
