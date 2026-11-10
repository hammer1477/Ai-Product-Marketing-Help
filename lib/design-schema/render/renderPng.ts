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
  });

  const rendered = resvg.render();
  return rendered.asPng();
}
