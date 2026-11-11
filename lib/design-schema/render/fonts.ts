import { readFile } from "node:fs/promises";
import path from "node:path";
import { FONT_FILES, type FontStyle } from "../fontRegistry";

export type LoadedFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700 | 800;
  style: FontStyle;
};

// The browser preview fetches these same files (see FontFaces.tsx), so the
// export and the preview are drawn from identical glyphs.
const FONT_DIR = path.join(process.cwd(), "public/fonts");

let cachedFonts: Promise<LoadedFont[]> | null = null;

// Satori requires embedded font buffers (TTF/OTF/WOFF) — it cannot use
// system fonts. Every face in the registry is loaded once and cached.
export function loadFonts(): Promise<LoadedFont[]> {
  if (!cachedFonts) {
    cachedFonts = Promise.all(
      FONT_FILES.map(async (f) => ({
        name: f.family,
        data: await readFile(path.join(FONT_DIR, f.file)),
        weight: f.weight,
        style: f.style,
      })),
    ).catch((err) => {
      cachedFonts = null;
      throw err;
    });
  }
  return cachedFonts;
}
