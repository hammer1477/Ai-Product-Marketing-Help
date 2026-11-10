import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { DesignSchema } from "../types";
import { loadFonts } from "./fonts";
import { renderSchemaToSatoriTree } from "./satoriTree";

export type RenderOptions = {
  /** Export resolution multiplier over the schema's canvas dimensions. */
  scale?: number;
};

// The only place real text rendering happens: Design Schema -> Satori SVG
// (deterministic, headless, flexbox-based layout) -> resvg PNG rasterization
// at the requested export resolution. Must run in the Node.js runtime, not
// edge — @resvg/resvg-js needs native bindings.
export async function renderSchemaToPng(
  schema: DesignSchema,
  options: RenderOptions = {},
): Promise<Buffer> {
  const scale = options.scale ?? 2;
  const fonts = await loadFonts();

  const svg = await satori(renderSchemaToSatoriTree(schema), {
    width: schema.canvas.width,
    height: schema.canvas.height,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: schema.canvas.width * scale },
    // Rasterisation quality. The defaults favour speed, which shows up on
    // an export this large as soft image resampling and visible stair-
    // stepping on the ellipses the glow and callouts are built from. A
    // poster is rendered once and looked at for a long time, so the trade
    // goes the other way here.
    imageRendering: 0, // optimizeQuality
    shapeRendering: 2, // geometricPrecision
    textRendering: 1, // optimizeLegibility
  });

  const rendered = resvg.render();
  return rendered.asPng();
}
