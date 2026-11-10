import satori from "satori";
import type { DesignSchema } from "../types";
import { loadFonts } from "./fonts";
import { renderSchemaToSatoriTree } from "./satoriTree";

// Satori's output is already vector — this is the step the PNG exporter
// was throwing away after rasterising it.
//
// What that buys: text, pills, rules, callout lines, the faked gradients
// and the product glow all become real vector geometry, sharp at any size
// from a thumbnail to a billboard, in a file a designer can open in
// Illustrator or Figma. What it can't buy: the product photo and the
// generated scene are photographs, so they ride along as embedded raster.
// That's the same arrangement as any real print ad — vector artwork with
// placed images — not a shortcoming of this pipeline.
export async function renderSchemaToSvg(schema: DesignSchema): Promise<string> {
  const fonts = await loadFonts();

  // embedFont (Satori's default) converts glyphs to outlines rather than
  // emitting <text> that depends on the viewer having Inter and Playfair
  // installed. An exported file has to look right on a machine that has
  // neither, so correctness wins over keeping the text selectable.
  return satori(renderSchemaToSatoriTree(schema), {
    width: schema.canvas.width,
    height: schema.canvas.height,
    fonts,
  });
}
