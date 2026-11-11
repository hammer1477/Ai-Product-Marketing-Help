// The block library.
//
// Before this existed, a template owned both *what* went on a poster and
// *where* it went. That capped the output at however many templates were
// hand-written, and capped the information at whatever slots those
// templates happened to have — a headline, a paragraph, a few bullets, and
// nowhere to put a spec table or a price.
//
// Now the model composes the poster from these blocks: which ones, how
// many, in what order. Code still owns every coordinate, because asking a
// language model for pixel positions is how you get text printed on top of
// other text. The division is strict:
//
//   model decides   →  which blocks, their order, and their content
//   code decides    →  x, y, width, height, and whether it all fits
//
// Adding a new kind of content to posters means adding a block here and a
// renderer for it — not editing every template.

import { ICON_KEYS, isIconName, type IconName } from "../../design-schema/iconKeys";

export type SpecItem = {
  /** Short label, e.g. "Battery". */
  label: string;
  /** The value, e.g. "57 hours". */
  value: string;
};

export type Block =
  /** Small outlined pill — brand name, "New", "Limited". */
  | { type: "badge"; text: string }
  /** The main display line. Always present. */
  | { type: "headline"; text: string }
  /** A supporting line under the headline — the promise, in one breath. */
  | { type: "subheadline"; text: string }
  /** One or two supporting sentences. */
  | { type: "description"; text: string }
  /** Icon + text rows. The workhorse for selling points. */
  | { type: "featureList"; items: string[]; /** Parallel to items; chosen by the model. */ icons?: IconName[] }
  /** Two-column label/value pairs — the densest way to show real specs. */
  | { type: "specGrid"; items: SpecItem[] }
  /** Two or three oversized figures with captions underneath. */
  | { type: "statRow"; items: SpecItem[] }
  /** Price, optionally with a struck-through comparison and a note. */
  | { type: "priceBlock"; value: string; compareAt?: string; note?: string }
  /** Star row plus a caption, e.g. "4.8 · 2,300 reviews". */
  | { type: "rating"; stars: number; caption: string }
  /** Short reassurance items rendered inline, dot-separated. */
  | { type: "trustStrip"; items: string[] }
  /** The button. Always present. */
  | { type: "cta"; text: string }
  /** A hairline rule, for separating sections of the stack. */
  | { type: "divider" };

export type BlockType = Block["type"];

export const BLOCK_TYPES: BlockType[] = [
  "badge",
  "headline",
  "subheadline",
  "description",
  "featureList",
  "specGrid",
  "statRow",
  "priceBlock",
  "rating",
  "trustStrip",
  "cta",
  "divider",
];

/** Blocks the poster is meaningless without — never dropped when fitting. */
export const REQUIRED_BLOCKS: BlockType[] = ["headline", "cta"];

/**
 * Order blocks are sacrificed in when the stack doesn't fit, least
 * important first. Dropping an ornament beats overprinting a spec.
 */
export const DROP_ORDER: BlockType[] = [
  "divider",
  "trustStrip",
  "rating",
  "statRow",
  "badge",
  "subheadline",
  "specGrid",
  "description",
  "featureList",
  "priceBlock",
];

// ---------------------------------------------------------------------------
// The shape the model actually returns
// ---------------------------------------------------------------------------

// Gemini's structured-output schema has no union type, so every block
// arrives as one permissive object and is narrowed here. Treating that
// output as untrusted isn't ceremony: a block with the wrong fields filled
// in would otherwise render as an empty box in the middle of the design.
export type RawBlock = {
  type?: string;
  text?: string;
  items?: Array<{ label?: string; value?: string; text?: string; icon?: string }>;
  value?: string;
  compareAt?: string;
  note?: string;
  stars?: number;
  caption?: string;
};

function cleanString(input: unknown, maxLength: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…` : trimmed;
}

/**
 * Narrows one raw block to a typed one, or returns null if it can't be
 * rendered meaningfully. Partial blocks are dropped rather than repaired —
 * a half-filled spec table is worse than no spec table.
 */
function normalizeBlock(raw: RawBlock): Block | null {
  switch (raw.type) {
    case "badge": {
      const text = cleanString(raw.text, 24);
      return text ? { type: "badge", text } : null;
    }

    case "headline": {
      const text = cleanString(raw.text, 90);
      return text ? { type: "headline", text } : null;
    }

    case "subheadline": {
      const text = cleanString(raw.text, 110);
      return text ? { type: "subheadline", text } : null;
    }

    case "description": {
      const text = cleanString(raw.text, 220);
      return text ? { type: "description", text } : null;
    }

    case "featureList": {
      const rows = (raw.items ?? [])
        .map((item) => ({ text: cleanString(item.text ?? item.value ?? item.label, 60), icon: item.icon }))
        .filter((row): row is { text: string; icon: string | undefined } => row.text !== null)
        .slice(0, 6);
      if (rows.length === 0) return null;
      return {
        type: "featureList",
        items: rows.map((row) => row.text),
        // Only kept when the model actually chose icons; otherwise the
        // renderer's own varied rotation reads better than a column of ticks.
        icons: rows.some((row) => isIconName(row.icon))
          ? rows.map((row) => (isIconName(row.icon) ? row.icon : "check"))
          : undefined,
      };
    }

    case "specGrid":
    case "statRow": {
      const items = (raw.items ?? [])
        .map((item) => {
          const label = cleanString(item.label, 28);
          const value = cleanString(item.value, 28);
          return label && value ? { label, value } : null;
        })
        .filter((item): item is SpecItem => item !== null)
        .slice(0, raw.type === "statRow" ? 3 : 8);
      return items.length > 0 ? { type: raw.type, items } : null;
    }

    case "priceBlock": {
      const value = cleanString(raw.value ?? raw.text, 24);
      if (!value) return null;
      return {
        type: "priceBlock",
        value,
        compareAt: cleanString(raw.compareAt, 24) ?? undefined,
        note: cleanString(raw.note, 40) ?? undefined,
      };
    }

    case "rating": {
      const caption = cleanString(raw.caption ?? raw.text, 40);
      const stars = typeof raw.stars === "number" ? Math.round(raw.stars) : 5;
      if (!caption) return null;
      return { type: "rating", stars: Math.max(1, Math.min(5, stars)), caption };
    }

    case "trustStrip": {
      const items = (raw.items ?? [])
        .map((item) => cleanString(item.text ?? item.value ?? item.label, 30))
        .filter((item): item is string => item !== null)
        .slice(0, 4);
      return items.length > 0 ? { type: "trustStrip", items } : null;
    }

    case "cta": {
      const text = cleanString(raw.text, 30);
      return text ? { type: "cta", text } : null;
    }

    case "divider":
      return { type: "divider" };

    default:
      return null;
  }
}

/**
 * Normalizes the model's block list into a renderable one, enforcing the
 * invariants the layout engine relies on: exactly one headline, exactly one
 * CTA, the CTA last, and no duplicate singleton blocks.
 */
export function normalizeBlocks(rawBlocks: RawBlock[] | undefined, fallback: {
  headline: string;
  ctaLabel: string;
  sellingPoints: string[];
}): Block[] {
  const normalized = (rawBlocks ?? [])
    .map(normalizeBlock)
    .filter((block): block is Block => block !== null);

  const singletons: BlockType[] = ["badge", "headline", "subheadline", "description", "priceBlock", "rating", "cta"];
  const seen = new Set<BlockType>();
  const deduped = normalized.filter((block) => {
    if (!singletons.includes(block.type)) return true;
    if (seen.has(block.type)) return false;
    seen.add(block.type);
    return true;
  });

  // A poster with no headline or no button isn't a poster, so both are
  // synthesized from the copy the model already returned rather than
  // failing the generation.
  const blocks: Block[] = deduped.filter((block) => block.type !== "cta");
  if (!blocks.some((block) => block.type === "headline")) {
    blocks.unshift({ type: "headline", text: fallback.headline });
  }

  // A poster carrying only measurements sells nothing. The prompt asks for
  // reasons to buy, but a prompt is a request, not a guarantee — when the
  // model returns a spec table and no benefits, the separately-generated
  // selling points stand in for them.
  const hasBenefits = blocks.some((block) => block.type === "featureList");
  if (!hasBenefits && fallback.sellingPoints.length > 0) {
    const items = fallback.sellingPoints
      .map((point) => cleanString(point, 60))
      .filter((point): point is string => point !== null)
      .slice(0, 4);

    if (items.length > 0) {
      // Below the spec table if there is one, so the objective facts lead
      // and the benefits land closer to the button.
      const specIndex = blocks.findIndex((block) => block.type === "specGrid");
      const insertAt = specIndex >= 0 ? specIndex + 1 : blocks.length;
      blocks.splice(insertAt, 0, { type: "featureList", items });
    }
  }

  const cta = deduped.find((block) => block.type === "cta");
  blocks.push(cta ?? { type: "cta", text: fallback.ctaLabel });

  // A divider is a separator; one at either end separates nothing.
  while (blocks.length > 0 && blocks[0].type === "divider") blocks.shift();

  return blocks;
}

// ---------------------------------------------------------------------------
// Schema handed to the model
// ---------------------------------------------------------------------------

export const BLOCKS_SCHEMA = {
  type: "array",
  description:
    "The poster's content, composed from blocks and rendered top to bottom in this order. " +
    "Build it from the FACT SHEET you were given: choose the blocks that suit THIS product and fill " +
    "them with its strongest facts. Use 6 to 10 blocks, and between them show at least eight separate " +
    "facts when the fact sheet has them. Always include exactly one headline, exactly one cta, and — " +
    "unless the product has no stated benefits at all — one featureList. Use a specGrid whenever the " +
    "fact sheet has two or more measurable specs, a statRow for the two or three most impressive " +
    "figures, a priceBlock whenever a price is known, and a trustStrip for stated guarantees, " +
    "shipping or what's included. Never state a fact the fact sheet does not support. " +
    "CRITICAL: a specification is not a selling point. '51 mm lens width' is a measurement; " +
    "'blocks 100% of UV rays' is a reason to buy. Measurements belong in specGrid, reasons to " +
    "buy belong in featureList, and a poster made only of measurements sells nothing. Don't repeat " +
    "the same fact in two blocks.",
  items: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: BLOCK_TYPES,
        description:
          "badge = small brand, 'New' or offer pill (max 3 words). " +
          "headline = the main line. " +
          "subheadline = one line under the headline that completes its promise (max 12 words). " +
          "description = one or two sentences on what this is and why it matters — not a " +
          "list of specifications in sentence form. " +
          "featureList = reasons to buy, in the customer's words ('Blocks 100% of UV rays'), " +
          "never measurements and never a restatement of specGrid. " +
          "specGrid = objective measurements with their names ('Lens width' / '51 mm'), up to 8. " +
          "statRow = the two or three figures most worth shouting about. " +
          "priceBlock = the price. rating = stars and review count, ONLY if stated. " +
          "trustStrip = short reassurances like free shipping, warranty, what's in the box. " +
          "cta = the button. divider = a hairline rule between sections.",
      },
      text: { type: "string", description: "For badge, headline, subheadline, description and cta." },
      items: {
        type: "array",
        description:
          "For featureList use text and icon on each item. For specGrid and statRow use " +
          "label and value — label is the short name ('Battery'), value is the figure ('57 h'). " +
          "For trustStrip use text.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            text: { type: "string" },
            icon: {
              type: "string",
              enum: [...ICON_KEYS],
              description: "featureList only: the icon that best depicts this benefit.",
            },
          },
        },
      },
      value: { type: "string", description: "For priceBlock: the price as displayed." },
      compareAt: { type: "string", description: "For priceBlock: a struck-through original price, ONLY if stated." },
      note: { type: "string", description: "For priceBlock: a short note such as 'incl. VAT'." },
      stars: { type: "number", description: "For rating: 1 to 5." },
      caption: { type: "string", description: "For rating: e.g. '4.8 · 2,300 reviews'." },
    },
    propertyOrdering: ["type", "text", "items", "value", "compareAt", "note", "stars", "caption"],
    required: ["type"],
  },
};
