import { FONT_FILES } from "@/lib/design-schema/fontRegistry";

// @font-face rules for every typeface a design can use, pointing at the
// same files the server embeds. Without these the preview drew Playfair,
// Bebas and the rest in a fallback font — which wraps differently, so the
// preview lied about where lines would break.
const CSS = FONT_FILES.map(
  (f) =>
    `@font-face{font-family:"${f.family}";src:url("/fonts/${f.file}") format("woff");` +
    `font-weight:${f.weight};font-style:${f.style};font-display:block;}`,
).join("\n");

export function FontFaces() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
