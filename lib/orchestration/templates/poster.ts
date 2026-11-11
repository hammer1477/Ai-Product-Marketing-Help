import type { DesignDensity, DesignSchema } from "../../design-schema/types";
import type { ResolvedStyle } from "../styles";
import type { Block } from "../blocks/types";
import { contentScore, type TemplateCtx } from "./kit";
import { paint } from "./theme";
import { templateFor, type TemplateDef } from "./registry";
import type { Fact } from "../factSheet";

export type PosterInput = {
  blocks: Block[];
  productImageUrl: string;
  density: DesignDensity;
  /** Base style; `templateId` selects the design. */
  style: ResolvedStyle;
  backgroundImageUrl?: string;
  /** Whether the product photo's backdrop was successfully removed. */
  cutoutApplied: boolean;
  productAspectRatio: number;
  /** Product or brand name, used for display type (mastheads, giant words). */
  productName?: string;
  /** The extracted fact sheet, kept so the editor can offer unused facts. */
  facts?: Fact[];
};

/** A short display word for decorative type. */
function displayWord(input: PosterInput): string {
  const badge = input.blocks.find((b) => b.type === "badge");
  const candidate =
    input.productName?.trim() || (badge?.type === "badge" ? badge.text.trim() : "") || headlineWord(input.blocks);
  // Giant type needs a short word; long names keep their first words.
  if (candidate.length <= 16) return candidate;
  const words = candidate.split(/\s+/);
  let out = words[0];
  for (const word of words.slice(1)) {
    if ((out + " " + word).length > 16) break;
    out += ` ${word}`;
  }
  return out;
}

function headlineWord(blocks: Block[]): string {
  const headline = blocks.find((b) => b.type === "headline");
  return headline?.type === "headline" ? headline.text.split(/\s+/).slice(0, 2).join(" ") : "New";
}

function build(input: PosterInput, template: TemplateDef) {
  const { style, palette } = paint(input.style, template.scheme, template.typography, template.cta);
  const ctx: TemplateCtx = {
    blocks: input.blocks,
    s: style,
    p: palette,
    product: {
      src: input.productImageUrl,
      cutoutApplied: input.cutoutApplied,
      aspectRatio: input.productAspectRatio,
    },
    scene: template.usesScene ? input.backgroundImageUrl : undefined,
    word: displayWord(input),
  };
  return { ...template.build(ctx), palette };
}

/** The colours a style actually paints with under its template — for the editor's pickers. */
export function paletteFor(style: ResolvedStyle) {
  const template = templateFor(style);
  return paint(style, template.scheme, template.typography, template.cta).palette;
}

/** Facts `template` would put on the poster for this content. */
export function templateContentScore(input: PosterInput, template: TemplateDef): number {
  return contentScore(build(input, template).placed);
}

// A poster is two independent decisions: a *template* (the design — its
// scheme, typography, ornament and where everything sits) and a
// *composition* (which blocks fill it, chosen by the model). Templates own
// geometry only; they never know what content they're holding.
export function composePosterSchema(input: PosterInput): DesignSchema {
  const template = templateFor(input.style);
  const { layers, placed, palette } = build(input, template);

  // A template that doesn't draw the scene still has to carry it, or
  // switching to a template that does would find nothing to draw.
  const sceneDrawn = layers.some((layer) => layer.id === "bg-image");

  return {
    schemaVersion: 1,
    canvas: {
      width: 1080,
      height: 1080,
      backgroundColor: palette.ground,
      aspectRatioPreset: "instagram-square",
    },
    meta: {
      density: input.density,
      templateKey: `tpl-${template.id}-${placed.map((block) => block.type).join("+")}`,
      composition: {
        // The full composition, not just what this template fitted — so
        // content a compact template had to leave out comes back when the
        // user switches to a roomier one.
        blocks: input.blocks,
        placedTypes: placed.map((block) => block.type),
        style: { ...input.style, templateId: template.id },
        cutoutApplied: input.cutoutApplied,
        productAspectRatio: input.productAspectRatio,
        productName: input.productName,
        facts: input.facts,
        sceneUrl: sceneDrawn ? undefined : input.backgroundImageUrl,
      },
    },
    layers,
  };
}
