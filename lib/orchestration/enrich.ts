import type { Block, SpecItem } from "./blocks/types";
import type { Fact, FactKind } from "./factSheet";

// The floor under every generated poster.
//
// The prompt asks for a description, a feature list and a spec grid on
// every ad, and usually gets them — but a prompt is a request. On the runs
// where the model skimps (an overloaded model falling back to a lighter
// one, a rushed composition), the poster went out with three adjectives
// and no detail. This fills what's missing from the fact sheet the same
// call already wrote, so the result is never thinner than its own facts.

const FEATURE_KINDS: FactKind[] = ["feature", "benefit", "usage", "included", "compatibility", "care"];
const SPEC_KINDS: FactKind[] = ["spec", "material", "ingredient", "dimension", "compatibility", "care", "other"];

const MIN_FEATURES = 3;
const TARGET_FEATURES = 5;
const MIN_SPECS = 2;
const TARGET_SPECS = 3;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The list items already on the poster, for de-duplication. Prose (the
 * headline, description) doesn't count: a spec table or feature list that
 * restates what the description says, in scannable form, is the point.
 */
function shownText(blocks: Block[]): string[] {
  return blocks.flatMap((b): string[] => {
    if ("text" in b) return [];
    if (b.type === "featureList" || b.type === "trustStrip") return b.items;
    if (b.type === "specGrid" || b.type === "statRow") return b.items.flatMap((i) => [i.value, `${i.label} ${i.value}`]);
    return [];
  }).map(norm);
}

const STOP = new Set(["a", "an", "the", "and", "with", "of", "for", "in", "on", "to", "your", "fresh", "real"]);
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));

/** Same fact in other words: most of one's content words appear in the other. */
function alreadyShown(shown: string[], fact: Fact): boolean {
  const v = words(fact.value);
  if (v.size === 0) return true;
  return shown.some((s) => {
    const w = words(s);
    if (w.size === 0) return false;
    let common = 0;
    for (const x of v) if (w.has(x)) common++;
    return common / Math.min(v.size, w.size) >= 0.6;
  });
}

/** A fact as a feature line: the value when it reads as a phrase, else "label value". */
function asFeature(fact: Fact): string {
  const words = fact.value.trim().split(/\s+/).length;
  const line = words >= 2 ? fact.value : `${fact.label} ${fact.value}`;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** Inserts `block` before the price and button, where added detail reads naturally. */
function insertBeforeClose(blocks: Block[], block: Block): Block[] {
  const at = blocks.findIndex((b) => b.type === "priceBlock" || b.type === "cta");
  const i = at < 0 ? blocks.length : at;
  return [...blocks.slice(0, i), block, ...blocks.slice(i)];
}

export function enrichBlocks(blocks: Block[], facts: Fact[] | undefined, description: string | undefined): Block[] {
  let out = [...blocks];
  const ranked = [...(facts ?? [])].sort((a, b) => b.strength - a.strength);

  // Description: the copy's own description field, placed under the headline block group.
  const desc = description?.replace(/\s+/g, " ").trim();
  if (!out.some((b) => b.type === "description") && desc && desc.length > 12) {
    const after = Math.max(out.findIndex((b) => b.type === "subheadline"), out.findIndex((b) => b.type === "headline"));
    out.splice(after + 1, 0, { type: "description", text: desc.length > 220 ? `${desc.slice(0, 217).trimEnd()}…` : desc });
  }

  // Specs first: they take the concrete attributes (materials, ingredients),
  // and features are written from what's left.
  const specAt = out.findIndex((b) => b.type === "specGrid");
  const currentSpecs = specAt >= 0 ? (out[specAt] as Extract<Block, { type: "specGrid" }>) : null;
  if (!currentSpecs || currentSpecs.items.filter((i) => i.value.trim()).length < MIN_SPECS) {
    const shown = shownText(out);
    const items: SpecItem[] = [...(currentSpecs?.items.filter((i) => i.value.trim()) ?? [])];
    const usedLabels = new Set(items.map((i) => norm(i.label)));
    for (const fact of ranked) {
      if (items.length >= TARGET_SPECS) break;
      if (!SPEC_KINDS.includes(fact.kind)) continue;
      if (usedLabels.has(norm(fact.label)) || alreadyShown(shown, fact)) continue;
      items.push({ label: fact.label, value: fact.value });
      usedLabels.add(norm(fact.label));
      shown.push(norm(fact.value));
    }
    if (items.length >= MIN_SPECS) {
      const next: Block = { type: "specGrid", items };
      out = specAt >= 0 ? out.map((b, i) => (i === specAt ? next : b)) : insertBeforeClose(out, next);
    }
  }

  // Features.
  const featureAt = out.findIndex((b) => b.type === "featureList");
  const currentFeatures = featureAt >= 0 ? (out[featureAt] as Extract<Block, { type: "featureList" }>) : null;
  if (!currentFeatures || currentFeatures.items.filter((i) => i.trim()).length < MIN_FEATURES) {
    const shown = shownText(out);
    const items = [...(currentFeatures?.items.filter((i) => i.trim()) ?? [])];
    for (const fact of ranked) {
      if (items.length >= TARGET_FEATURES) break;
      if (!FEATURE_KINDS.includes(fact.kind) && fact.kind !== "material" && fact.kind !== "ingredient") continue;
      if (alreadyShown(shown, fact)) continue;
      items.push(asFeature(fact));
      shown.push(norm(fact.value));
    }
    if (items.length >= MIN_FEATURES) {
      const icons = currentFeatures?.icons;
      const next: Block = { type: "featureList", items, ...(icons ? { icons: [...icons, ...items.slice(icons.length).map(() => "check" as const)] } : {}) };
      out = featureAt >= 0 ? out.map((b, i) => (i === featureAt ? next : b)) : insertBeforeClose(out, next);
    }
  }

  return out;
}
