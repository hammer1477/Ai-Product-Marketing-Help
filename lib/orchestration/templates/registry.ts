import type { CreativeConcept } from "../types";
import type { TemplateDef, TemplateTag } from "./catalog/types";
import {
  duotone,
  editorialCorner,
  galleryArch,
  magazineCover,
  midnightSplit,
  podium,
  specCallout,
  spotlight,
  windowCard,
} from "./catalog/scene";
import {
  auroraGlass,
  bento,
  bigNumber,
  colorBlock,
  marqueeDrop,
  minimalLuxe,
  neoBrutal,
  pastelSoft,
  receipt,
  retroSunset,
  saleBurst,
  scrapbook,
  swissGrid,
  techHud,
  typeBehind,
  y2kOrbit,
} from "./catalog/graphic";

export type { TemplateDef, TemplateTag };

/** Every poster design, in the order the picker shows them. */
export const TEMPLATES: TemplateDef[] = [
  midnightSplit,
  galleryArch,
  neoBrutal,
  auroraGlass,
  magazineCover,
  swissGrid,
  typeBehind,
  podium,
  retroSunset,
  bento,
  minimalLuxe,
  saleBurst,
  scrapbook,
  receipt,
  colorBlock,
  y2kOrbit,
  windowCard,
  pastelSoft,
  techHud,
  bigNumber,
  duotone,
  marqueeDrop,
  spotlight,
  editorialCorner,
  specCallout,
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/** Designs saved before templates existed recorded an arrangement name. */
const LEGACY_LAYOUTS: Record<string, string> = {
  split: "midnight-split",
  spotlight: "spotlight",
  editorial: "editorial-corner",
  callout: "spec-callout",
};

export function getTemplate(id: string | undefined): TemplateDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function templateFor(style: { templateId?: string; layout?: string }): TemplateDef {
  return (
    getTemplate(style.templateId) ??
    getTemplate(style.layout ? LEGACY_LAYOUTS[style.layout] : undefined) ??
    midnightSplit
  );
}

const CATEGORY_TAGS: Record<string, TemplateTag[]> = {
  "Beauty & Skincare": ["beauty", "luxury"],
  "Fashion & Apparel": ["fashion", "luxury"],
  "Food & Beverage": ["food"],
  "Health & Wellness": ["wellness"],
  "Electronics & Technology": ["tech", "specs"],
  "Home & Living": ["home"],
  "Toys & Kids": ["kids"],
  Automotive: ["auto"],
};

const PROMO_OBJECTIVES = new Set(["sales-conversion", "discount-campaign", "seasonal-promotion"]);

export type ChooseInput = {
  category: string;
  objective: string | null;
  concept: CreativeConcept;
  /** Template ids this project already produced, newest first. */
  recent: string[];
  /** Facts a template would actually show for this content. */
  score: (template: TemplateDef) => number;
  /** The creative director's picks, best first. */
  preferred?: string[];
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number;
};

/**
 * Chooses the design for a generation.
 *
 * Code makes this choice, not the model. Asking the model for "something
 * different" produced the same arrangement with a new background — the
 * exact complaint. Here a regeneration is *guaranteed* a design this
 * project hasn't used recently, drawn at random with a bias toward
 * templates that suit the product's category and goal.
 *
 * Content still gates it: a template that would show only a sliver of the
 * composed facts is passed over while better-fitting ones remain.
 */
export function chooseTemplate(input: ChooseInput): TemplateDef {
  const random = input.random ?? Math.random;
  const wanted = new Set<TemplateTag>(CATEGORY_TAGS[input.category] ?? []);
  if (input.objective && PROMO_OBJECTIVES.has(input.objective)) wanted.add("promo");
  if (input.concept === "infographic") wanted.add("specs");
  if (input.concept === "premium_photo") wanted.add("minimal");

  // Avoid everything recent, but never so much that the pool runs dry.
  const memory = Math.min(input.recent.length, TEMPLATES.length - 6);
  const avoid = new Set(input.recent.slice(0, memory));
  let pool = TEMPLATES.filter((t) => !avoid.has(t.id));

  const scores = new Map(pool.map((t) => [t.id, input.score(t)]));
  const best = Math.max(...scores.values());
  const floor = Math.min(best, Math.max(4, Math.round(best * 0.5)));
  const fitting = pool.filter((t) => (scores.get(t.id) ?? 0) >= floor);
  if (fitting.length >= 3) pool = fitting;

  // The model's picks dominate; category fit breaks ties among the rest.
  // Recent designs were already removed above, so a regeneration falls to
  // the model's next choice rather than repeating its first.
  const preferred = input.preferred ?? [];
  const preferenceBoost = (id: string) => {
    const rank = preferred.indexOf(id);
    return rank < 0 ? 0 : [14, 9, 6, 4, 3, 2][rank] ?? 2;
  };
  const weights = pool.map(
    (t) => 1 + t.tags.filter((tag) => wanted.has(tag)).length * 2.5 + preferenceBoost(t.id),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
