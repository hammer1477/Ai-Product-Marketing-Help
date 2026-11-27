import type { DesignSchema } from "../design-schema/types";
import { isImageLayer } from "../design-schema/types";
import type { ResolvedStyle } from "./styles";
import type { Block, BlockType } from "./blocks/types";
import { composePosterSchema } from "./templates/poster";
import type { Fact } from "./factSheet";
import type { BrandLogo, LogoStyle } from "../brand/kit";
import type { AdFormat } from "./formats";

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
  /** Items each list block showed, when the template trimmed it to fit. */
  placedCounts?: Partial<Record<BlockType, number>>;
  /** The scene, when the current template doesn't draw it as a layer. */
  sceneUrl?: string;
  /** Everything extraction found — the editor offers the unused ones. */
  facts?: Fact[];
  logo?: BrandLogo;
  logoHidden?: boolean;
  logoStyle?: LogoStyle;
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
    placedCounts:
      candidate.placedCounts && typeof candidate.placedCounts === "object" ? candidate.placedCounts : undefined,
    sceneUrl: typeof candidate.sceneUrl === "string" ? candidate.sceneUrl : undefined,
    facts: Array.isArray(candidate.facts) ? candidate.facts : undefined,
    logo: readLogo(candidate.logo),
    logoHidden: candidate.logoHidden === true,
    logoStyle: readLogoStyle(candidate.logoStyle),
  };
}

const POSITIONS = ["auto", "top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

function readLogoStyle(raw: unknown): LogoStyle | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  return {
    position: typeof s.position === "string" && POSITIONS.includes(s.position) ? (s.position as LogoStyle["position"]) : undefined,
    color: typeof s.color === "string" && (s.color === "original" || /^#[0-9a-f]{6}$/i.test(s.color)) ? s.color : undefined,
    size: s.size === "s" || s.size === "m" || s.size === "l" ? s.size : undefined,
    chip: s.chip === "auto" || s.chip === "on" || s.chip === "off" ? s.chip : undefined,
  };
}

function readLogo(raw: unknown): BrandLogo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const logo = raw as Partial<BrandLogo>;
  if (typeof logo.src !== "string" || !logo.src.startsWith("data:image/")) return undefined;
  return {
    src: logo.src,
    aspect: typeof logo.aspect === "number" && logo.aspect > 0 ? logo.aspect : 1,
    tone: logo.tone === "light" ? "light" : "dark",
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
    blocks: pruneBlocks(composition.blocks),
    productImageUrl,
    backgroundImageUrl,
    density: schema.meta.density,
    style: composition.style,
    cutoutApplied: composition.cutoutApplied,
    productAspectRatio: composition.productAspectRatio,
    productName: composition.productName,
    facts: composition.facts,
    logo: composition.logo,
    logoHidden: composition.logoHidden,
    logoStyle: composition.logoStyle,
  });
}

/**
 * The same design in another size. Re-laid-out from its composition, so a
 * story is a real reframe of the ad, not a crop. Designs saved before
 * compositions existed come back unchanged.
 */
export function schemaInFormat(schema: DesignSchema, format: AdFormat): DesignSchema {
  const composition = readComposition(schema);
  if (!composition || (composition.style.format ?? "square") === format) return schema;
  return recomposePoster(schema, { ...composition, style: { ...composition.style, format } });
}

/**
 * Drops what the user hasn't filled in yet — a just-added blank feature, an
 * empty subheadline — so half-finished edits never draw as empty rows.
 * The headline and button stay even when empty: they're structural.
 */
export function pruneBlocks(blocks: Block[]): Block[] {
  const filled = (s: string | undefined) => Boolean(s && s.trim());
  return blocks.flatMap((block): Block[] => {
    switch (block.type) {
      case "badge":
      case "subheadline":
      case "description":
        return filled(block.text) ? [block] : [];
      case "featureList": {
        const keep = block.items.map((item, i) => ({ item, icon: block.icons?.[i] })).filter((x) => filled(x.item));
        return keep.length ? [{ ...block, items: keep.map((x) => x.item), icons: block.icons ? keep.map((x) => x.icon ?? "check") : undefined }] : [];
      }
      case "trustStrip": {
        const items = block.items.filter(filled);
        return items.length ? [{ ...block, items }] : [];
      }
      case "specGrid":
      case "statRow": {
        const items = block.items.filter((it) => filled(it.value));
        return items.length ? [{ ...block, items }] : [];
      }
      case "priceBlock":
        return filled(block.value) ? [block] : [];
      case "rating":
        return [block];
      default:
        return [block];
    }
  });
}
