import { isHex } from "./color";
import { TEMPLATES } from "./templates/registry";
import { CREATIVE_CONTENT_SCHEMA } from "./types";
import { FACT_SHEET_SCHEMA } from "./factSheet";

// The creative director's note to the designer.
//
// The model used to hand the layout engine a scene prompt, five colours and
// a mood word — everything else was decided without it. This brief lets it
// say which designs in the catalogue suit *this* product, what short name
// should carry the display type, and a second accent to pair with the
// first. Code still has the final say on the template (to guarantee a
// regeneration never repeats), but it now chooses among the model's picks.

export type DesignBrief = {
  /** Template ids, best fit first. */
  templatePreferences: string[];
  /** Short name for mastheads, giant type and tapes. */
  displayName?: string;
  /** A second accent, for stickers, meshes and highlights. */
  secondaryAccent?: string;
  /** The angle the copy takes — recorded so regenerations try another. */
  copyAngle?: string;
};

const TEMPLATE_IDS = TEMPLATES.map((t) => t.id);

/** The catalogue as the model sees it: id, name, what it looks like, what it suits. */
export const TEMPLATE_CATALOGUE = TEMPLATES.map(
  (t) => `${t.id}: ${t.name} — ${t.blurb} (${t.scheme}; suits ${t.tags.join(", ")})`,
).join("\n");

const DESIGN_BRIEF_SCHEMA = {
  type: "object",
  description: "Your brief to the designer who will lay out the poster.",
  properties: {
    templatePreferences: {
      type: "array",
      items: { type: "string", enum: TEMPLATE_IDS },
      description:
        "The 4 poster designs from the catalogue that best suit THIS product, its audience and the " +
        "copy you wrote, best first. Match the design's mood to the product: luxury goods want " +
        "restraint, promotions want loud, spec-heavy products want designs that show many facts. " +
        "Prefer designs whose capacity fits how much content you composed.",
    },
    displayName: {
      type: "string",
      description:
        "Max 16 characters. The short name set in giant display type — usually the product " +
        "or brand name, shortened if needed ('Tune 520BT', 'Lumen C').",
    },
    secondaryAccent: {
      type: "string",
      description: "A second accent hex that pairs with colorAccent, for stickers and highlights.",
    },
    copyAngle: {
      type: "string",
      description: "Two to four words naming the copy's angle, e.g. 'all-day comfort', 'pro performance'.",
    },
  },
  propertyOrdering: ["templatePreferences", "displayName", "secondaryAccent", "copyAngle"],
  required: ["templatePreferences", "displayName", "copyAngle"],
};

/** The generation call's schema: fact sheet, content, art direction, design brief. */
export function creativeSchemaWithBrief() {
  return {
    ...CREATIVE_CONTENT_SCHEMA,
    properties: {
      factSheet: { ...FACT_SHEET_SCHEMA, description: "STEP 1: everything you extracted. Written before any copy." },
      ...CREATIVE_CONTENT_SCHEMA.properties,
      designBrief: DESIGN_BRIEF_SCHEMA,
    },
    // Gemini emits properties in this order: facts first, so the copy is
    // written from them; copy before the art direction that has to suit
    // it; the brief to the designer last.
    propertyOrdering: [
      "factSheet",
      "headline",
      "productName",
      "description",
      "sellingPoints",
      "ctaLabel",
      "badgeLabel",
      "blocks",
      "artDirection",
      "designBrief",
    ],
    required: ["factSheet", ...CREATIVE_CONTENT_SCHEMA.required, "designBrief"],
  };
}

/** Narrows the model's brief: unknown templates and malformed colours are dropped. */
export function normalizeDesignBrief(raw: Partial<DesignBrief> | undefined): DesignBrief {
  const prefs = (raw?.templatePreferences ?? []).filter(
    (id, i, all): id is string => typeof id === "string" && TEMPLATE_IDS.includes(id) && all.indexOf(id) === i,
  );
  const name = typeof raw?.displayName === "string" ? raw.displayName.trim().slice(0, 24) : "";
  return {
    templatePreferences: prefs.slice(0, 6),
    displayName: name || undefined,
    secondaryAccent: isHex(raw?.secondaryAccent) ? raw.secondaryAccent : undefined,
    copyAngle: typeof raw?.copyAngle === "string" ? raw.copyAngle.trim().slice(0, 40) || undefined : undefined,
  };
}
