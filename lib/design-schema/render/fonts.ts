import { readFile } from "node:fs/promises";
import path from "node:path";

export type LoadedFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700 | 800;
  style: "normal";
};

const FONT_DIR = path.join(process.cwd(), "lib/design-schema/render/fonts");

let cachedFonts: LoadedFont[] | null = null;

// Satori requires embedded font buffers (TTF/OTF/WOFF) — it cannot use
// system fonts. "Inter" (UI/body text) and "Playfair Display" (luxury
// serif, for headlines/product names) are the two font families embedded
// in Phase 1; allowlisting here is what lib/design-schema/types.ts's
// fontFamily field is constrained against in practice.
export async function loadFonts(): Promise<LoadedFont[]> {
  if (cachedFonts) return cachedFonts;

  const [interRegular, interBold, interExtraBold, playfairSemiBold, playfairBold] = await Promise.all([
    readFile(path.join(FONT_DIR, "Inter-Regular.woff")),
    readFile(path.join(FONT_DIR, "Inter-Bold.woff")),
    readFile(path.join(FONT_DIR, "Inter-ExtraBold.woff")),
    readFile(path.join(FONT_DIR, "PlayfairDisplay-SemiBold.woff")),
    readFile(path.join(FONT_DIR, "PlayfairDisplay-Bold.woff")),
  ]);

  cachedFonts = [
    { name: "Inter", data: interRegular, weight: 400, style: "normal" },
    { name: "Inter", data: interBold, weight: 700, style: "normal" },
    { name: "Inter", data: interExtraBold, weight: 800, style: "normal" },
    { name: "Playfair Display", data: playfairSemiBold, weight: 600, style: "normal" },
    { name: "Playfair Display", data: playfairBold, weight: 700, style: "normal" },
  ];

  return cachedFonts;
}
