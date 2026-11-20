// Flat Phase 1 cost per creative generation. Intentionally a single
// constant for now — swap for a lookup (by concept/density/provider) once
// real per-call provider costs are known and the business wants pricing
// tiers; nothing that calls this needs to change shape.
export const GENERATION_COST_CREDITS = 5;

/** One product photoshoot shot. Mirrors job_cost('photoshoot') in SQL. */
export const PHOTOSHOOT_COST_CREDITS = 3;
