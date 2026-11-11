import type { DesignSchema } from "../design-schema/types";
import { isImageLayer } from "../design-schema/types";
import type { ResolvedStyle } from "./styles";
import type { Block, BlockType } from "./blocks/types";
import { composePosterSchema } from "./templates/poster";
import type { Fact } from "./factSheet";

// Lets a saved design be re-laid-out instead of only patched.
//
// The composition — blocks, base style, chosen template — rides inside the
// schema, so the editor edits blocks and re-runs layout. That's also what
// makes template switching, recolouring and font changes possible after
// generation: they're all just a different style handed to the same
// composer.

export type PosterComposition = {
  blocks: Block[];
  style: ResolvedStyle;
  cutoutApplied: boolean;
  productAspectRatio: number;
  productName?: string;
  /** Block types the current template actually drew. */
  placedTypes?: BlockType[];
  /** The scene, when the current template doesn't draw it as a layer. */
  sceneUrl?: string;
  /** Everything extraction found — the editor offers the unused ones. */
  facts?: Fact[];
};

/**
 * Reads the composition back out of a schema, returning null for schemas
 * saved before compositions existed. Callers fall back to layer-level
 * editing in that case.
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
    productName: typeof candidate.productName === "string" ? candidate.productName : undefined,
    placedTypes: Array.isArray(candidate.placedTypes) ? candidate.placedTypes : undefined,
    sceneUrl: typeof candidate.sceneUrl === "string" ? candidate.sceneUrl : undefined,
    facts: Array.isArray(candidate.facts) ? candidate.facts : undefined,
  };
}

function layerSrc(schema: DesignSchema, id: string): string | undefined {
  const layer = schema.layers.find((candidate) => candidate.id === id);
  return layer && isImageLayer(layer) ? layer.src : undefined;
}

/** The images a schema carries, wherever the current template put them. */
export function readAssets(schema: DesignSchema, composition: PosterComposition) {
  return {
    productImageUrl: layerSrc(schema, "product-photo"),
    backgroundImageUrl: layerSrc(schema, "bg-image") ?? composition.sceneUrl,
  };
}

/**
 * Rebuilds a schema from an edited composition.
 *
 * Pure and synchronous — no network, no AI, no image processing — which is
 * what lets the browser re-run it on every keystroke, and render every
 * template as a live thumbnail. Images are lifted off the existing schema
 * rather than stored twice.
 */
export function recomposePoster(schema: DesignSchema, composition: PosterComposition): DesignSchema {
  const { productImageUrl, backgroundImageUrl } = readAssets(schema, composition);
  if (!productImageUrl) return schema;

  return composePosterSchema({
    blocks: composition.blocks,
    productImageUrl,
    backgroundImageUrl,
    density: schema.meta.density,
    style: composition.style,
    cutoutApplied: composition.cutoutApplied,
    productAspectRatio: composition.productAspectRatio,
    productName: composition.productName,
    facts: composition.facts,
  });
}
