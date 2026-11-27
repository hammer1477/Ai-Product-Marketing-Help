"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles } from "lucide-react";
import type { Suggestions, SuggestType } from "@/lib/copy/suggestBlock";
import type { Block, SpecItem } from "@/lib/orchestration/blocks/types";
import { ICON_KEYS, type IconName } from "@/lib/design-schema/iconKeys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Edits the composition rather than the rendered layers.
//
// Every field is named by the block it belongs to, because the block is
// what's being edited. The user can add to every list, add whole sections
// the AI left out, reorder them and remove them — the poster re-lays itself
// out around whatever they decide.

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

/** Sections the user can add, with what each is for and a starting point. */
const ADDABLE: Array<{ type: Block["type"]; hint: string; make: (price?: string) => Block }> = [
  { type: "badge", hint: "A small tag: brand, 'New', 'Handmade'", make: () => ({ type: "badge", text: "New" }) },
  { type: "subheadline", hint: "One line that completes the headline", make: () => ({ type: "subheadline", text: "" }) },
  { type: "description", hint: "A sentence or two of detail", make: () => ({ type: "description", text: "" }) },
  { type: "featureList", hint: "Benefits with icons", make: () => ({ type: "featureList", items: [""], icons: ["check"] }) },
  { type: "specGrid", hint: "Name / value specifications", make: () => ({ type: "specGrid", items: [{ label: "", value: "" }] }) },
  { type: "statRow", hint: "2–3 big numbers that impress", make: () => ({ type: "statRow", items: [{ label: "", value: "" }] }) },
  { type: "priceBlock", hint: "Your price, and a 'was' price", make: (price) => ({ type: "priceBlock", value: price ?? "" }) },
  { type: "rating", hint: "Stars and a review count", make: () => ({ type: "rating", stars: 5, caption: "" }) },
  { type: "trustStrip", hint: "Short reassurances: delivery, returns", make: () => ({ type: "trustStrip", items: [""] }) },
  { type: "divider", hint: "A thin line between sections", make: () => ({ type: "divider" }) },
];

/** How many items each list holds before the design gets crowded. */
const LIST_LIMITS: Partial<Record<Block["type"], number>> = { featureList: 10, specGrid: 12, statRow: 4, trustStrip: 6 };

export function BlockEditPanel({
  blocks,
  hiddenTypes = [],
  onChange,
  productPrice,
  placedCounts = {},
  projectId,
}: {
  /** Enables the AI "Suggest" buttons. */
  projectId?: string;
  blocks: Block[];
  /** Block types the current template had no room for. */
  hiddenTypes?: Block["type"][];
  /** Items each list actually shows in the current template. */
  placedCounts?: Partial<Record<Block["type"], number>>;
  onChange: (next: Block[]) => void;
  /** The product's price, to start a new price section with. */
  productPrice?: string;
}) {
  function updateBlock(index: number, next: Block) {
    onChange(blocks.map((block, i) => (i === index ? next : block)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  }

  function addBlock(make: () => Block) {
    // New sections go just above the button, where they read naturally.
    const ctaAt = blocks.findIndex((b) => b.type === "cta");
    const at = ctaAt < 0 ? blocks.length : ctaAt;
    onChange([...blocks.slice(0, at), make(), ...blocks.slice(at)]);
  }

  const [suggestFor, setSuggestFor] = useState<number | null>(null);
  const present = new Set(blocks.map((b) => b.type));
  const addable = ADDABLE.filter((a) => a.type === "divider" || !present.has(a.type));

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
                <span className="ml-2 text-xs font-normal text-muted-foreground">Not shown in this template</span>
              )}
            </h3>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveBlock(index, -1)}
                disabled={index === 0}
                className="h-7 px-1.5 text-muted-foreground"
                aria-label={`Move ${BLOCK_TITLES[block.type]} up`}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveBlock(index, 1)}
                disabled={index === blocks.length - 1}
                className="h-7 px-1.5 text-muted-foreground"
                aria-label={`Move ${BLOCK_TITLES[block.type]} down`}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              {projectId && SUGGESTABLE.includes(block.type as SuggestType) && (
                <SuggestButton
                  open={suggestFor === index}
                  onClick={() => setSuggestFor(suggestFor === index ? null : index)}
                />
              )}
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
            </div>
          </header>

          <BlockFields block={block} index={index} onChange={(next) => updateBlock(index, next)} />
          {projectId && suggestFor === index && (
            <SuggestionTray
              key={block.type}
              projectId={projectId}
              block={block}
              blocks={blocks}
              onApply={(next) => updateBlock(index, next)}
            />
          )}
          <TrimNotice block={block} shown={placedCounts[block.type]} hidden={hiddenTypes.includes(block.type)} />
        </section>
      ))}

      {addable.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-lg border border-dashed p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Plus className="size-4" /> Add a section
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {addable.map((a) => (
              <button
                key={a.type}
                type="button"
                onClick={() => addBlock(() => a.make(productPrice))}
                className="rounded-md border px-2.5 py-2 text-left transition hover:bg-muted"
              >
                <span className="block text-xs font-semibold">{BLOCK_TITLES[a.type]}</span>
                <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const SUGGESTABLE: SuggestType[] = ["headline", "subheadline", "description", "featureList", "specGrid"];

function SuggestButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className="h-7 gap-1 px-2 text-xs"
      title="Ideas from our copywriter, written for this product"
    >
      <Sparkles className="size-3.5" /> Suggest
    </Button>
  );
}

type TrayState = { loading: boolean; error: string | null; data: Suggestions | null; used: string[] };

/**
 * The AI's options for one section. Text sections swap in the option you
 * click; lists take each option you click as a new item.
 */
function SuggestionTray({
  projectId,
  block,
  blocks,
  onApply,
}: {
  projectId: string;
  block: Block;
  blocks: Block[];
  onApply: (next: Block) => void;
}) {
  const [state, setState] = useState<TrayState>({ loading: true, error: null, data: null, used: [] });

  async function load() {
    setState((s) => ({ ...s, loading: true, error: null }));
    await fetchOptions();
  }

  async function fetchOptions() {
    try {
      const res = await fetch(`/api/creative-projects/${projectId}/suggest-copy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: block.type, blocks }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't write suggestions right now.");
      setState({ loading: false, error: null, data: body as Suggestions, used: [] });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }

  // Fetch once when the tray opens (state starts as loading).
  useEffect(() => {
    void fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limit = LIST_LIMITS[block.type] ?? Infinity;
  const full = "items" in block && block.items.length >= limit;
  const isList = "items" in block;

  function apply(option: string | { label: string; value: string }) {
    const key = typeof option === "string" ? option : `${option.label}|${option.value}`;
    if (block.type === "featureList" && typeof option === "string") {
      if (full) return;
      const items = [...block.items.filter((i) => i.trim()), option];
      const icons = block.icons ? [...block.icons.slice(0, items.length - 1), "check" as IconName] : undefined;
      onApply({ ...block, items, ...(icons ? { icons } : {}) });
    } else if (block.type === "specGrid" && typeof option !== "string") {
      if (full) return;
      onApply({ ...block, items: [...block.items.filter((i) => i.label.trim() || i.value.trim()), option] });
    } else if ("text" in block && typeof option === "string") {
      onApply({ ...block, text: option } as Block);
    }
    setState((s) => ({ ...s, used: [...s.used, key] }));
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed bg-muted/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          {isList ? (full ? "This list is full. Remove one to add another." : "Click to add") : "Click to use"}
        </span>
        <Button variant="ghost" size="sm" onClick={load} disabled={state.loading} className="h-6 gap-1 px-1.5 text-[11px]">
          {state.loading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          {state.loading ? "Writing" : "More ideas"}
        </Button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.loading && !state.data && (
        <p className="text-xs text-muted-foreground">Studying your product and writing options...</p>
      )}
      {state.data && (
        <div className="flex flex-col gap-1.5">
          {state.data.type === "specGrid"
            ? state.data.options.map((o) => {
                const key = `${o.label}|${o.value}`;
                const used = state.used.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={used || full}
                    onClick={() => apply(o)}
                    className="flex items-baseline gap-2 rounded border bg-background px-2 py-1.5 text-left text-xs transition hover:border-foreground/50 disabled:opacity-40"
                  >
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{o.label}</span>
                    <span className="font-medium">{o.value}</span>
                    {used && <span className="ml-auto text-[10px] text-muted-foreground">Added</span>}
                  </button>
                );
              })
            : state.data.options.map((o) => {
                const used = state.used.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={isList && (used || full)}
                    onClick={() => apply(o)}
                    className="rounded border bg-background px-2 py-1.5 text-left text-xs transition hover:border-foreground/50 disabled:opacity-40"
                  >
                    {o}
                    {used && isList && <span className="ml-2 text-[10px] text-muted-foreground">Added</span>}
                  </button>
                );
              })}
        </div>
      )}
    </div>
  );
}

/** Says when a list has more items than this design shows. */
function TrimNotice({ block, shown, hidden }: { block: Block; shown?: number; hidden: boolean }) {
  if (hidden || shown === undefined || !("items" in block)) return null;
  const filled = (block.items as unknown[]).filter((item) =>
    typeof item === "string" ? item.trim() : (item as SpecItem).value?.trim(),
  ).length;
  if (shown >= filled) return null;
  return (
    <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
      This design shows {shown} of {filled}. The rest are kept — pick a roomier template in Design, or put your
      favourites first.
    </p>
  );
}

function AddItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="h-8 w-fit gap-1 text-xs">
      <Plus className="size-3.5" /> {label}
    </Button>
  );
}

function BlockFields({ block, index, onChange }: { block: Block; index: number; onChange: (next: Block) => void }) {
  const id = (suffix: string) => `block-${index}-${suffix}`;
  const limit = LIST_LIMITS[block.type] ?? Infinity;

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
          placeholder={block.type === "subheadline" ? "e.g. Handmade, ready to hang" : undefined}
        />
      );

    case "featureList":
      return (
        <div className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={id(`icon-${i}`)} className="sr-only">
                  Feature {i + 1} icon
                </Label>
                <select
                  id={id(`icon-${i}`)}
                  value={block.icons?.[i] ?? "check"}
                  onChange={(e) => {
                    const icons = block.items.map((_, j) => block.icons?.[j] ?? "check") as IconName[];
                    icons[i] = e.target.value as IconName;
                    onChange({ ...block, icons });
                  }}
                  className="h-9 rounded-md border border-input bg-transparent px-1.5 text-xs"
                  title="Icon"
                >
                  {ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <Field
                  id={id(`item-${i}`)}
                  label={`Feature ${i + 1}`}
                  value={item}
                  placeholder="e.g. Hand-painted wood"
                  onChange={(value) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? value : x)) })}
                  onRemove={
                    block.items.length > 1
                      ? () =>
                          onChange({
                            ...block,
                            items: block.items.filter((_, j) => j !== i),
                            icons: block.icons?.filter((_, j) => j !== i),
                          })
                      : undefined
                  }
                />
              </div>
            </div>
          ))}
          {block.items.length < limit && (
            <AddItemButton
              label="Add feature"
              onClick={() =>
                onChange({
                  ...block,
                  items: [...block.items, ""],
                  icons: [...block.items.map((_, j) => block.icons?.[j] ?? ("check" as IconName)), "check"],
                })
              }
            />
          )}
        </div>
      );

    case "trustStrip":
      return (
        <div className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <Field
              key={i}
              id={id(`item-${i}`)}
              label={`Item ${i + 1}`}
              value={item}
              placeholder="e.g. Ships in 2 days"
              onChange={(value) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? value : x)) })}
              onRemove={block.items.length > 1 ? () => onChange({ ...block, items: block.items.filter((_, j) => j !== i) }) : undefined}
            />
          ))}
          {block.items.length < limit && (
            <AddItemButton label="Add reassurance" onClick={() => onChange({ ...block, items: [...block.items, ""] })} />
          )}
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
              // A spec's label is half its meaning — "51 mm" on its own says nothing.
              labelCaption={block.type === "specGrid" ? `Spec ${i + 1} name` : `Figure ${i + 1} caption`}
              valueCaption={block.type === "specGrid" ? `Spec ${i + 1} value` : `Figure ${i + 1}`}
              onChange={(next) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? next : x)) })}
              onRemove={block.items.length > 1 ? () => onChange({ ...block, items: block.items.filter((_, j) => j !== i) }) : undefined}
            />
          ))}
          {block.items.length < limit && (
            <AddItemButton
              label={block.type === "specGrid" ? "Add spec" : "Add figure"}
              onClick={() => onChange({ ...block, items: [...block.items, { label: "", value: "" }] })}
            />
          )}
        </div>
      );

    case "priceBlock":
      return (
        <div className="flex flex-col gap-3">
          <Field id={id("price")} label="Price" value={block.value} placeholder="e.g. 450 EGP" onChange={(value) => onChange({ ...block, value })} />
          <Field
            id={id("compare")}
            label="Was (struck through)"
            value={block.compareAt ?? ""}
            onChange={(compareAt) => onChange({ ...block, compareAt: compareAt || undefined })}
          />
          <Field id={id("note")} label="Note" value={block.note ?? ""} onChange={(note) => onChange({ ...block, note: note || undefined })} />
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
              onChange={(e) => onChange({ ...block, stars: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
            />
          </div>
          <Field
            id={id("caption")}
            label="Caption"
            value={block.caption}
            placeholder="e.g. 4.9 · 120 reviews"
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
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="flex-1" />
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
        <Input id={`${id}-label`} value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor={`${id}-value`}>{valueCaption}</Label>
        <Input id={`${id}-value`} value={item.value} onChange={(e) => onChange({ ...item, value: e.target.value })} />
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
