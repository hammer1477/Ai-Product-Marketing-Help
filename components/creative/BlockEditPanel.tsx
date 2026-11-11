"use client";

import type { Block, SpecItem } from "@/lib/orchestration/blocks/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Edits the composition rather than the rendered layers.
//
// The previous panel read text layers back out of the finished design,
// which meant it could only guess what each one was. Spec values showed up
// as "Selling point", spec labels and the price didn't show up at all, and
// nothing linked a label to its value. Here every field is named by the
// block it belongs to, because the block is what's being edited.

const BLOCK_TITLES: Record<Block["type"], string> = {
  badge: "Badge",
  headline: "Headline",
  subheadline: "Subheadline",
  description: "Description",
  featureList: "Feature list",
  specGrid: "Specifications",
  statRow: "Key figures",
  priceBlock: "Price",
  rating: "Rating",
  trustStrip: "Reassurances",
  cta: "Button",
  divider: "Divider",
};

export function BlockEditPanel({
  blocks,
  hiddenTypes = [],
  onChange,
}: {
  blocks: Block[];
  /** Block types the current template had no room for. */
  hiddenTypes?: Block["type"][];
  onChange: (next: Block[]) => void;
}) {
  function updateBlock(index: number, next: Block) {
    onChange(blocks.map((block, i) => (i === index ? next : block)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, index) => (
        <section
          key={`${block.type}-${index}`}
          className={`flex flex-col gap-3 rounded-lg border bg-card p-4 ${hiddenTypes.includes(block.type) ? "opacity-60" : ""}`}
        >
          <header className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {BLOCK_TITLES[block.type]}
              {hiddenTypes.includes(block.type) && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Not shown in this template
                </span>
              )}
            </h3>
            {/* The headline and button are structural — a poster without
                either isn't a smaller poster, it's a broken one. */}
            {block.type !== "headline" && block.type !== "cta" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeBlock(index)}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </Button>
            )}
          </header>

          <BlockFields
            block={block}
            index={index}
            onChange={(next) => updateBlock(index, next)}
          />
        </section>
      ))}
    </div>
  );
}

function BlockFields({
  block,
  index,
  onChange,
}: {
  block: Block;
  index: number;
  onChange: (next: Block) => void;
}) {
  const id = (suffix: string) => `block-${index}-${suffix}`;

  switch (block.type) {
    case "badge":
    case "headline":
    case "subheadline":
    case "description":
    case "cta":
      return (
        <Field
          id={id("text")}
          label={block.type === "cta" ? "Button label" : BLOCK_TITLES[block.type]}
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
        />
      );

    case "featureList":
    case "trustStrip":
      return (
        <div className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <Field
              key={i}
              id={id(`item-${i}`)}
              label={`${block.type === "featureList" ? "Feature" : "Item"} ${i + 1}`}
              value={item}
              onChange={(value) =>
                onChange({
                  ...block,
                  items: block.items.map((existing, j) => (j === i ? value : existing)),
                })
              }
              onRemove={
                block.items.length > 1
                  ? () =>
                      onChange(
                        block.type === "featureList"
                          ? {
                              ...block,
                              items: block.items.filter((_, j) => j !== i),
                              icons: block.icons?.filter((_, j) => j !== i),
                            }
                          : { ...block, items: block.items.filter((_, j) => j !== i) },
                      )
                  : undefined
              }
            />
          ))}
        </div>
      );

    case "specGrid":
    case "statRow":
      return (
        <div className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <SpecFields
              key={i}
              id={id(`spec-${i}`)}
              item={item}
              // A spec's label is half its meaning — "51 mm" on its own
              // says nothing, which is exactly what the old panel showed.
              labelCaption={block.type === "specGrid" ? `Spec ${i + 1} name` : `Figure ${i + 1} caption`}
              valueCaption={block.type === "specGrid" ? `Spec ${i + 1} value` : `Figure ${i + 1}`}
              onChange={(next) =>
                onChange({
                  ...block,
                  items: block.items.map((existing, j) => (j === i ? next : existing)),
                })
              }
              onRemove={
                block.items.length > 1
                  ? () => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })
                  : undefined
              }
            />
          ))}
        </div>
      );

    case "priceBlock":
      return (
        <div className="flex flex-col gap-3">
          <Field
            id={id("price")}
            label="Price"
            value={block.value}
            onChange={(value) => onChange({ ...block, value })}
          />
          <Field
            id={id("compare")}
            label="Was (struck through)"
            value={block.compareAt ?? ""}
            onChange={(compareAt) => onChange({ ...block, compareAt: compareAt || undefined })}
          />
          <Field
            id={id("note")}
            label="Note"
            value={block.note ?? ""}
            onChange={(note) => onChange({ ...block, note: note || undefined })}
          />
        </div>
      );

    case "rating":
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={id("stars")}>Stars</Label>
            <Input
              id={id("stars")}
              type="number"
              min={1}
              max={5}
              value={block.stars}
              onChange={(e) =>
                onChange({
                  ...block,
                  stars: Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                })
              }
            />
          </div>
          <Field
            id={id("caption")}
            label="Caption"
            value={block.caption}
            onChange={(caption) => onChange({ ...block, caption })}
          />
        </div>
      );

    case "divider":
      return <p className="text-sm text-muted-foreground">A horizontal rule. Nothing to edit.</p>;
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  onRemove,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="shrink-0 px-2 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${label}`}
          >
            ×
          </Button>
        )}
      </div>
    </div>
  );
}

function SpecFields({
  id,
  item,
  labelCaption,
  valueCaption,
  onChange,
  onRemove,
}: {
  id: string;
  item: SpecItem;
  labelCaption: string;
  valueCaption: string;
  onChange: (next: SpecItem) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={`${id}-label`}>{labelCaption}</Label>
        <Input
          id={`${id}-label`}
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={`${id}-value`}>{valueCaption}</Label>
        <Input
          id={`${id}-value`}
          value={item.value}
          onChange={(e) => onChange({ ...item, value: e.target.value })}
        />
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="shrink-0 px-2 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${labelCaption}`}
        >
          ×
        </Button>
      )}
    </div>
  );
}
