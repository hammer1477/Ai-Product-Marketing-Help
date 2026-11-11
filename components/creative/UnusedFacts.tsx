"use client";

import { Plus } from "lucide-react";
import type { Fact } from "@/lib/orchestration/factSheet";
import type { Block } from "@/lib/orchestration/blocks/types";

// Extraction usually finds more than one poster can hold. Rather than
// throwing the rest away, the editor offers them: one click adds a fact to
// the right block — measurements to the spec table, benefits to the
// feature list — and the poster re-flows around it.

const SPEC_KINDS = new Set<Fact["kind"]>(["spec", "dimension", "material", "ingredient", "compatibility", "price"]);

const SOURCE_LABEL: Record<Fact["source"], string> = {
  description: "your description",
  attributes: "your product fields",
  photo: "printed on the product",
};

function blockText(blocks: Block[]): string {
  return JSON.stringify(blocks).toLowerCase();
}

/** Facts whose value isn't already somewhere on the poster. */
export function unusedFacts(facts: Fact[] | undefined, blocks: Block[]): Fact[] {
  if (!facts?.length) return [];
  const onPoster = blockText(blocks);
  return facts.filter((fact) => !onPoster.includes(fact.value.toLowerCase()));
}

/** Adds a fact to the block it belongs in, creating that block if needed. */
export function addFact(blocks: Block[], fact: Fact): Block[] {
  const asSpec = SPEC_KINDS.has(fact.kind);
  const targetType = asSpec ? "specGrid" : "featureList";
  const index = blocks.findIndex((b) => b.type === targetType);

  if (index >= 0) {
    return blocks.map((block, i) => {
      if (i !== index) return block;
      if (block.type === "specGrid") return { ...block, items: [...block.items, { label: fact.label, value: fact.value }] };
      if (block.type === "featureList") {
        return {
          ...block,
          items: [...block.items, fact.value],
          icons: block.icons ? [...block.icons, "check"] : undefined,
        };
      }
      return block;
    });
  }

  const created: Block = asSpec
    ? { type: "specGrid", items: [{ label: fact.label, value: fact.value }] }
    : { type: "featureList", items: [fact.value] };
  // Just above the button, where supporting detail reads naturally.
  const ctaIndex = blocks.findIndex((b) => b.type === "cta");
  const at = ctaIndex >= 0 ? ctaIndex : blocks.length;
  return [...blocks.slice(0, at), created, ...blocks.slice(at)];
}

export function UnusedFacts({
  facts,
  blocks,
  onChange,
}: {
  facts: Fact[] | undefined;
  blocks: Block[];
  onChange: (next: Block[]) => void;
}) {
  const unused = unusedFacts(facts, blocks);
  if (unused.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
      <header>
        <h3 className="text-sm font-semibold">More facts the AI found</h3>
        <p className="text-xs text-muted-foreground">
          Not on the poster yet. Click to add — specs go to the spec table, benefits to the feature list.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {unused.map((fact) => (
          <button
            key={`${fact.label}|${fact.value}`}
            type="button"
            onClick={() => onChange(addFact(blocks, fact))}
            title={`From ${SOURCE_LABEL[fact.source]}`}
            className="group flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-left text-xs transition hover:border-foreground hover:bg-muted"
          >
            <Plus className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground" />
            <span className="text-muted-foreground">{fact.label}:</span>
            <span className="font-medium">{fact.value}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
