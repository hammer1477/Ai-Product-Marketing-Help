import { readFile } from "node:fs/promises";
import path from "node:path";

export type LoadedFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 800;
  style: "normal";
};

const FONT_DIR = path.join(process.cwd(), "lib/design-schema/render/fonts");

let cachedFonts: LoadedFont[] | null = null;

// Satori requires embedded font buffers (TTF/OTF/WOFF) — it cannot use
// system fonts. "Inter" is the only font family embedded in Phase 1;
// allowlisting here is what lib/design-schema/types.ts's fontFamily field
// is constrained against in practice.
export async function loadFonts(): Promise<LoadedFont[]> {
  if (cachedFonts) return cachedFonts;

  const [regular, bold, extraBold] = await Promise.all([
    readFile(path.join(FONT_DIR, "Inter-Regular.woff")),
    readFile(path.join(FONT_DIR, "Inter-Bold.woff")),
    readFile(path.join(FONT_DIR, "Inter-ExtraBold.woff")),
  ]);

  cachedFonts = [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: bold, weight: 700, style: "normal" },
    { name: "Inter", data: extraBold, weight: 800, style: "normal" },
  ];

  return cachedFonts;
}
