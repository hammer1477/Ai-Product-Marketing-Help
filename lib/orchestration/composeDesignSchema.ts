import type { DesignSchema } from "../design-schema/types";
import type { ConceptDecision, CreativeContent } from "./types";
import type { ResolvedStyle } from "./styles";
import { composePosterSchema, templateContentScore, type PosterInput } from "./templates/poster";
import { normalizeBlocks } from "./blocks/types";
import { chooseTemplate } from "./templates/registry";
import type { Fact } from "./factSheet";

export type ComposeInput = {
  content: CreativeContent;
  /** Same photo with its studio backdrop removed, when that was possible. */
  productCutoutUrl: string;
  cutoutApplied: boolean;
  /** Intrinsic aspect ratio (w/h) of the cutout, for grounding the product. */
  productAspectRatio: number;
  decision: ConceptDecision;
  style: ResolvedStyle;
  backgroundImageUrl?: string;
  /** Short name for display type; defaults to the product name. */
  displayName?: string;
  facts?: Fact[];
};

/** Normalised blocks plus the poster input, before a template is chosen. */
export function posterInputFor(input: ComposeInput): PosterInput {
  const { content } = input;
  // normalizeBlocks is the gate that turns the model's loose output into
  // something renderable, synthesizing a headline and a button from the
  // flat copy fields if either is missing.
  const blocks = normalizeBlocks(content.blocks, {
    headline: content.headline,
    ctaLabel: content.ctaLabel,
    sellingPoints: content.sellingPoints ?? [],
  });

  return {
    blocks,
    productImageUrl: input.productCutoutUrl,
    density: input.decision.density,
    style: input.style,
    backgroundImageUrl: input.backgroundImageUrl,
    cutoutApplied: input.cutoutApplied,
    productAspectRatio: input.productAspectRatio,
    productName: input.displayName ?? content.productName,
    facts: input.facts,
  };
}

/**
 * Composes the poster. With `templateId` set on the style the design is
 * fixed; otherwise one is chosen for this product, avoiding `recent`.
 */
export function composeDesignSchema(
  input: ComposeInput,
  choice: { category: string; objective: string | null; recent: string[]; preferred?: string[] } = {
    category: "",
    objective: null,
    recent: [],
  },
): DesignSchema {
  const poster = posterInputFor(input);

  const templateId =
    input.style.templateId ??
    chooseTemplate({
      category: choice.category,
      objective: choice.objective,
      concept: input.decision.concept,
      recent: choice.recent,
      preferred: choice.preferred,
      score: (template) => templateContentScore(poster, template),
    }).id;

  return composePosterSchema({ ...poster, style: { ...poster.style, templateId } });
}
