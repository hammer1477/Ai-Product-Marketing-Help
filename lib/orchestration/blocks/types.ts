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
  /** One or two supporting sentences. */
  | { type: "description"; text: string }
  /** Icon + text rows. The workhorse for selling points. */
  | { type: "featureList"; items: string[] }
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
  items?: Array<{ label?: string; value?: string; text?: string }>;
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

    case "description": {
      const text = cleanString(raw.text, 220);
      return text ? { type: "description", text } : null;
    }

    case "featureList": {
      const items = (raw.items ?? [])
        .map((item) => cleanString(item.text ?? item.value ?? item.label, 60))
        .filter((item): item is string => item !== null)
        .slice(0, 6);
      return items.length > 0 ? { type: "featureList", items } : null;
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
        .slice(0, raw.type === "statRow" ? 3 : 6);
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

  const singletons: BlockType[] = ["badge", "headline", "description", "priceBlock", "rating", "cta"];
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
    "Choose the blocks that suit THIS product. Use 5 to 8 blocks, and between them show at " +
    "least six separate facts drawn from the description and attributes. Always include " +
    "exactly one headline, exactly one cta, and — unless the product has no stated benefits " +
    "at all — one featureList. Prefer a specGrid whenever the description mentions two or more " +
    "concrete attributes, even if they appear in prose rather than as labelled fields: naming " +
    "them ('Frame' / 'Golden metal') is extraction, not invention. What you must never do is " +
    "state a fact the input does not support — an unstated price, an invented review count, a " +
    "measurement nobody gave you. " +
    "CRITICAL: a specification is not a selling point. '51 mm lens width' is a measurement; " +
    "'blocks 100% of UV rays' is a reason to buy. Measurements belong in specGrid, reasons to " +
    "buy belong in featureList, and a poster made only of measurements sells nothing. Derive " +
    "each feature from the stated facts — if the input says 'full UV protection coating', the " +
    "feature is 'Full UV protection', not a restatement of the dimensions.",
  items: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: BLOCK_TYPES,
        description:
          "badge = small brand or 'New' pill. " +
          "headline = the main line. " +
          "description = one or two sentences on what this is and why it matters — not a " +
          "list of specifications in sentence form. " +
          "featureList = reasons to buy, in the customer's words ('Blocks 100% of UV rays'), " +
          "never measurements and never a restatement of specGrid. " +
          "specGrid = objective measurements with their names ('Lens width' / '51 mm'). " +
          "statRow = the two or three figures most worth shouting about. " +
          "priceBlock = the price. rating = stars and review count. " +
          "trustStrip = short reassurances like free shipping. " +
          "cta = the button. divider = a hairline rule between sections.",
      },
      text: { type: "string", description: "For badge, headline, description and cta." },
      items: {
        type: "array",
        description:
          "For featureList use the text field of each item. For specGrid and statRow use " +
          "label and value — label is the short name ('Battery'), value is the figure ('57 h').",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            text: { type: "string" },
          },
        },
      },
      value: { type: "string", description: "For priceBlock: the price as displayed." },
      compareAt: { type: "string", description: "For priceBlock: a struck-through original price." },
      note: { type: "string", description: "For priceBlock: a short note such as 'incl. VAT'." },
      stars: { type: "number", description: "For rating: 1 to 5." },
      caption: { type: "string", description: "For rating: e.g. '4.8 · 2,300 reviews'." },
    },
    required: ["type"],
  },
};
