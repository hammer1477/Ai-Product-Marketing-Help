// Flat Phase 1 cost per creative generation. Intentionally a single
// constant for now — swap for a lookup (by concept/density/provider) once
// real per-call provider costs are known and the business wants pricing
// tiers; nothing that calls this needs to change shape.
export const GENERATION_COST_CREDITS = 5;

/** One product photoshoot shot. Mirrors job_cost('photoshoot') in SQL. */
export const PHOTOSHOOT_COST_CREDITS = 3;

/** Agency campaign: a strategy fee plus a price per ad. Mirrors job_cost() in SQL. */
export const CAMPAIGN_STRATEGY_CREDITS = 10;
export const CAMPAIGN_AD_CREDITS = 5;
export function campaignCost(ads: number): number {
  return CAMPAIGN_STRATEGY_CREDITS + CAMPAIGN_AD_CREDITS * ads;
}

/** One-time gift when someone is made a Friend of the Master. */
export const FRIEND_GIFT_CREDITS = 10_000;
