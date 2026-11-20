import { GENERATION_COST_CREDITS } from "./pricing";

// Credit packs sold through Stripe Checkout. Prices live here, not in the
// Stripe dashboard: Checkout is created with inline price_data, so changing
// a price is a code change and there's no product catalogue to keep in sync.

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  /** Smallest currency unit (cents). */
  priceCents: number;
  blurb: string;
  popular?: boolean;
};

export const CREDIT_CURRENCY = "usd";

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter", credits: 100, priceCents: 500, blurb: "Try it on a few products." },
  { id: "creator", name: "Creator", credits: 500, priceCents: 1900, blurb: "For a shop's weekly ads.", popular: true },
  { id: "studio", name: "Studio", credits: 2000, priceCents: 5900, blurb: "Agencies and big catalogues." },
];

export function packById(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}

/** How many ad generations a pack buys. */
export function generationsIn(pack: CreditPack): number {
  return Math.floor(pack.credits / GENERATION_COST_CREDITS);
}

export function formatPrice(cents: number, currency = CREDIT_CURRENCY): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
