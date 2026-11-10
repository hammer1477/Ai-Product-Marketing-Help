import type { DesignSchema } from "../design-schema/types";
import { isImageLayer } from "../design-schema/types";
import type { ResolvedStyle } from "./styles";
import type { Block } from "./blocks/types";
import { composePosterSchema } from "./templates/poster";

// Lets a saved design be re-laid-out instead of only patched.
//
// The editor used to work on the rendered layer list, which is a lossy view
// of the design: once blocks are flattened to layers, a spec's label and
// its value are two unrelated text layers, a price is indistinguishable
// from a caption, and nothing records that any of them belonged together.
// That's why the edit panel showed "51 mm" labelled as a selling point and
// hid the price entirely.
//
// Carrying the composition inside the schema fixes that at the source. The
// editor reads blocks, edits blocks, and re-runs layout — so edits also
// re-flow instead of overflowing a box sized for the old text.

export type PosterComposition = {
  blocks: Block[];
  style: ResolvedStyle;
  cutoutApplied: boolean;
  productAspectRatio: number;
};

/**
 * Reads the composition back out of a schema, returning null for schemas
 * saved before compositions existed or for concepts that don't use blocks.
 * Callers fall back to layer-level editing in that case.
 */
export function readComposition(schema: DesignSchema): PosterComposition | null {
  const raw = schema.meta.composition;
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Partial<PosterComposition>;
  if (!Array.isArray(candidate.blocks) || candidate.blocks.length === 0) return null;
  if (!candidate.style || typeof candidate.style !== "object") return null;

  return {
    blocks: candidate.blocks,
    style: candidate.style as ResolvedStyle,
    cutoutApplied: candidate.cutoutApplied === true,
    productAspectRatio:
      typeof candidate.productAspectRatio === "number" && candidate.productAspectRatio > 0
        ? candidate.productAspectRatio
        : 1,
  };
}

function layerSrc(schema: DesignSchema, id: string): string | undefined {
  const layer = schema.layers.find((candidate) => candidate.id === id);
  return layer && isImageLayer(layer) ? layer.src : undefined;
}

/**
 * Rebuilds a schema from an edited composition.
 *
 * Pure and synchronous — no network, no AI, no image processing — which is
 * what lets the browser re-run it on every keystroke for a live preview
 * that re-flows. The product photo and background scene are lifted off the
 * existing schema rather than stored twice; they're already embedded there
 * as data URIs, and a megabyte of base64 copied into the metadata would
 * double the size of every saved design.
 */
export function recomposePoster(
  schema: DesignSchema,
  composition: PosterComposition,
): DesignSchema {
  const productImageUrl = layerSrc(schema, "product-photo");
  if (!productImageUrl) return schema;

  return composePosterSchema({
    blocks: composition.blocks,
    productImageUrl,
    backgroundImageUrl: layerSrc(schema, "bg-image"),
    density: schema.meta.density,
    style: composition.style,
    cutoutApplied: composition.cutoutApplied,
    productAspectRatio: composition.productAspectRatio,
  });
}
