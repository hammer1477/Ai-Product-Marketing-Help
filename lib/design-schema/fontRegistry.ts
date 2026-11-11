// The one list of typefaces a design may use.
//
// Shared by three consumers that must never disagree: the server renderer
// (Satori needs the font buffers), the browser preview (needs @font-face
// rules pointing at the same files), and text measurement (needs the
// metrics generated from those same files). The files live in
// public/fonts so the browser can fetch exactly what the server embeds —
// a preview drawn in a fallback font would wrap differently from the
// export, which is the whole class of bug measurement exists to prevent.
//
// All families are SIL Open Font License, sourced via Fontsource.

export type FontStyle = "normal" | "italic";

export type FontFile = {
  family: FontFamily;
  weight: 400 | 500 | 600 | 700 | 800;
  style: FontStyle;
  file: string;
};

export const FONT_FAMILIES = [
  "Inter",
  "Playfair Display",
  "Bebas Neue",
  "Anton",
  "DM Serif Display",
  "Space Grotesk",
  "Syne",
  "Archivo Black",
  "Cormorant Garamond",
  "Instrument Serif",
  "Unbounded",
  "Bricolage Grotesque",
  "Shrikhand",
  "Permanent Marker",
  "Space Mono",
  "Fraunces",
  "DM Sans",
] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];

export const FONT_FILES: FontFile[] = [
  { family: "Inter", weight: 400, style: "normal", file: "Inter-Regular.woff" },
  { family: "Inter", weight: 500, style: "normal", file: "Inter-Medium.woff" },
  { family: "Inter", weight: 600, style: "normal", file: "Inter-SemiBold.woff" },
  { family: "Inter", weight: 700, style: "normal", file: "Inter-Bold.woff" },
  { family: "Inter", weight: 800, style: "normal", file: "Inter-ExtraBold.woff" },
  { family: "Playfair Display", weight: 600, style: "normal", file: "PlayfairDisplay-SemiBold.woff" },
  { family: "Playfair Display", weight: 700, style: "normal", file: "PlayfairDisplay-Bold.woff" },
  { family: "Playfair Display", weight: 700, style: "italic", file: "PlayfairDisplay-700-italic.woff" },
  { family: "Bebas Neue", weight: 400, style: "normal", file: "BebasNeue-400.woff" },
  { family: "Anton", weight: 400, style: "normal", file: "Anton-400.woff" },
  { family: "DM Serif Display", weight: 400, style: "normal", file: "DMSerifDisplay-400.woff" },
  { family: "DM Serif Display", weight: 400, style: "italic", file: "DMSerifDisplay-400-italic.woff" },
  { family: "Space Grotesk", weight: 500, style: "normal", file: "SpaceGrotesk-500.woff" },
  { family: "Space Grotesk", weight: 700, style: "normal", file: "SpaceGrotesk-700.woff" },
  { family: "Syne", weight: 700, style: "normal", file: "Syne-700.woff" },
  { family: "Syne", weight: 800, style: "normal", file: "Syne-800.woff" },
  { family: "Archivo Black", weight: 400, style: "normal", file: "ArchivoBlack-400.woff" },
  { family: "Cormorant Garamond", weight: 600, style: "normal", file: "CormorantGaramond-600.woff" },
  { family: "Cormorant Garamond", weight: 600, style: "italic", file: "CormorantGaramond-600-italic.woff" },
  { family: "Instrument Serif", weight: 400, style: "normal", file: "InstrumentSerif-400.woff" },
  { family: "Instrument Serif", weight: 400, style: "italic", file: "InstrumentSerif-400-italic.woff" },
  { family: "Unbounded", weight: 700, style: "normal", file: "Unbounded-700.woff" },
  { family: "Unbounded", weight: 800, style: "normal", file: "Unbounded-800.woff" },
  { family: "Bricolage Grotesque", weight: 700, style: "normal", file: "BricolageGrotesque-700.woff" },
  { family: "Bricolage Grotesque", weight: 800, style: "normal", file: "BricolageGrotesque-800.woff" },
  { family: "Shrikhand", weight: 400, style: "normal", file: "Shrikhand-400.woff" },
  { family: "Permanent Marker", weight: 400, style: "normal", file: "PermanentMarker-400.woff" },
  { family: "Space Mono", weight: 400, style: "normal", file: "SpaceMono-400.woff" },
  { family: "Space Mono", weight: 700, style: "normal", file: "SpaceMono-700.woff" },
  { family: "Fraunces", weight: 700, style: "normal", file: "Fraunces-700.woff" },
  { family: "Fraunces", weight: 700, style: "italic", file: "Fraunces-700-italic.woff" },
  { family: "DM Sans", weight: 400, style: "normal", file: "DMSans-400.woff" },
  { family: "DM Sans", weight: 500, style: "normal", file: "DMSans-500.woff" },
  { family: "DM Sans", weight: 700, style: "normal", file: "DMSans-700.woff" },
];

/** Families suited to body copy — legible at 16–20px. */
export const BODY_FONTS: FontFamily[] = ["Inter", "DM Sans", "Space Grotesk", "Space Mono"];

export function isFontFamily(value: unknown): value is FontFamily {
  return typeof value === "string" && (FONT_FAMILIES as readonly string[]).includes(value);
}

/**
 * The file that will actually be drawn for a requested weight/style.
 *
 * Satori silently substitutes the nearest weight it has, so a template
 * asking Bebas Neue for 800 gets 400. Measuring against the requested
 * weight would then predict a wider line than renders. Snapping first
 * keeps the measured font and the drawn font the same file.
 */
export function resolveFontFile(
  family: string,
  weight: number,
  style: FontStyle = "normal",
): FontFile {
  const fam = isFontFamily(family) ? family : "Inter";
  const candidates = FONT_FILES.filter((f) => f.family === fam);
  const styled = candidates.filter((f) => f.style === style);
  const pool = styled.length > 0 ? styled : candidates;
  return pool.reduce((best, f) =>
    Math.abs(f.weight - weight) < Math.abs(best.weight - weight) ? f : best,
  );
}
