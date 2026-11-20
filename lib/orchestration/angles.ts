// Copy angles for campaign packs: the same product, sold from different
// directions, so a campaign is a real A/B test and not four recolours.

export type CopyAngle = {
  id: string;
  label: string;
  /** Shown in the picker. */
  blurb: string;
  /** Instruction handed to the copywriter. */
  brief: string;
};

export const COPY_ANGLES: CopyAngle[] = [
  {
    id: "benefit",
    label: "Big benefit",
    blurb: "The one outcome buyers want most.",
    brief:
      "Lead with the single biggest benefit to the buyer's life. The headline states the outcome, " +
      "not the feature; supporting blocks prove it.",
  },
  {
    id: "offer",
    label: "Offer & urgency",
    blurb: "Price, deal and a reason to buy now.",
    brief:
      "Lead with the price or offer and a reason to act now. Put the priceBlock and badge up front " +
      "and make the CTA urgent. If no price or offer is on the fact sheet, lead with value for money " +
      "and a direct call to act instead — never invent a discount, stock level, popularity ('viral', " +
      "'bestseller') or deadline to create urgency.",
  },
  {
    id: "proof",
    label: "Proof by numbers",
    blurb: "Specs, stats and ratings that convince.",
    brief:
      "Lead with hard proof. The headline states a concrete number from the fact sheet; use statRow, " +
      "specGrid and rating blocks to stack evidence. Spec-heavy designs suit this angle.",
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    blurb: "The feeling and moment of using it.",
    brief:
      "Lead with emotion and aspiration: the moment and feeling of using the product. Few blocks, an " +
      "evocative headline, a rich scene. Favour image-led, minimal designs.",
  },
  {
    id: "problem",
    label: "Problem → fix",
    blurb: "Name the pain, then show the cure.",
    brief:
      "Open with the frustration this product removes, phrased the way a buyer would say it, then " +
      "show how the product fixes it.",
  },
  {
    id: "gift",
    label: "Gift idea",
    blurb: "Positioned as the perfect present.",
    brief:
      "Position the product as a gift: who it's perfect for and why it'll be loved. Warm, generous " +
      "tone. Don't invent occasions or holiday dates.",
  },
];

export const DEFAULT_CAMPAIGN_ANGLES = ["benefit", "offer", "proof", "lifestyle"];

export function angleById(id: string | null | undefined): CopyAngle | undefined {
  return COPY_ANGLES.find((angle) => angle.id === id);
}
