"use client";

import { memo, useDeferredValue, useMemo } from "react";
import { Shuffle, RotateCcw, Check } from "lucide-react";
import type { DesignSchema } from "@/lib/design-schema/types";
import { BODY_FONTS, FONT_FAMILIES, isFontFamily, type FontFamily } from "@/lib/design-schema/fontRegistry";
import { recomposePoster, type PosterComposition } from "@/lib/orchestration/composition";
import { PALETTES, type ColorOverrides, type ResolvedStyle } from "@/lib/orchestration/styles";
import { TEMPLATES, templateFor } from "@/lib/orchestration/templates/registry";
import { paletteFor } from "@/lib/orchestration/templates/poster";
import { mix, WHITE } from "@/lib/orchestration/color";
import { DesignCanvasPreview } from "@/components/creative/DesignCanvasPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Everything about the look of a poster that isn't its words: which
// template, which colours, which typefaces. Every control here only edits
// the composition's style, and the poster is re-laid-out from it — so a
// template switch re-flows the copy rather than restyling stale geometry.

const COLOR_FIELDS: Array<{ key: keyof ColorOverrides; label: string }> = [
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Body text" },
  { key: "accent", label: "Accent" },
];

export function StylePanel({
  schema,
  composition,
  onChange,
}: {
  /** The saved schema, for its images. */
  schema: DesignSchema;
  composition: PosterComposition;
  onChange: (next: PosterComposition) => void;
}) {
  const style = composition.style;
  const current = templateFor(style);
  const palette = useMemo(() => paletteFor(style), [style]);
  // Thumbnails lag a beat behind edits so 25 live posters never block typing.
  const galleryComposition = useDeferredValue(composition);

  function setStyle(patch: Partial<ResolvedStyle>) {
    onChange({ ...composition, style: { ...style, ...patch } });
  }

  function shuffle() {
    const others = TEMPLATES.filter((t) => t.id !== current.id);
    const template = others[Math.floor(Math.random() * others.length)];
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    setStyle({
      templateId: template.id,
      ink: pal.ink,
      accent: pal.accent,
      textPrimary: pal.text,
      textMuted: pal.muted,
      panel: mix(pal.ink, WHITE, 0.07),
      accent2: undefined,
      colorOverrides: undefined,
      fontOverrides: undefined,
    });
  }

  const overrides = style.colorOverrides ?? {};
  const fonts = style.fontOverrides ?? {};

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <header className="flex items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Template</h3>
            <p className="text-xs text-muted-foreground">
              {current.name} — {current.blurb}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={shuffle} className="shrink-0 gap-1.5">
            <Shuffle className="size-3.5" />
            Shuffle
          </Button>
        </header>
        <TemplateGallery
          schema={schema}
          composition={galleryComposition}
          selectedId={current.id}
          onSelect={(templateId) => setStyle({ templateId })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Colours</h3>
          {style.colorOverrides && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStyle({ colorOverrides: undefined })}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            >
              <RotateCcw className="size-3" />
              Reset
            </Button>
          )}
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLOR_FIELDS.map(({ key, label }) => {
            const value = overrides[key] ?? palette[key === "background" ? "ground" : key];
            return (
              <label key={key} className="flex flex-col gap-1.5 text-xs font-medium">
                {label}
                <span className="flex items-center gap-2 rounded-md border bg-background p-1.5">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => setStyle({ colorOverrides: { ...overrides, [key]: e.target.value } })}
                    className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`${label} colour`}
                  />
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">{value}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="list" aria-label="Palettes">
          {PALETTES.map((pal) => (
            <button
              key={pal.name}
              type="button"
              role="listitem"
              title={pal.name}
              aria-label={`${pal.name} palette`}
              onClick={() =>
                setStyle({
                  ink: pal.ink,
                  accent: pal.accent,
                  textPrimary: pal.text,
                  textMuted: pal.muted,
                  panel: mix(pal.ink, WHITE, 0.07),
                  accent2: undefined,
                  colorOverrides: undefined,
                })
              }
              className={cn(
                "flex h-8 w-12 overflow-hidden rounded-md border ring-offset-2 ring-offset-background transition hover:scale-105",
                style.ink === pal.ink && style.accent === pal.accent && !style.colorOverrides && "ring-2 ring-foreground",
              )}
            >
              <span className="flex-1" style={{ background: pal.ink }} />
              <span className="w-4" style={{ background: pal.accent }} />
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Typography</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FontSelect
            id="font-headline"
            label="Headline font"
            value={fonts.headline}
            defaultLabel={`Template default (${current.typography.headline})`}
            options={[...FONT_FAMILIES]}
            onChange={(headline) => setStyle({ fontOverrides: { ...fonts, headline } })}
          />
          <FontSelect
            id="font-body"
            label="Body font"
            value={fonts.body}
            defaultLabel={`Template default (${current.typography.body})`}
            options={BODY_FONTS}
            onChange={(body) => setStyle({ fontOverrides: { ...fonts, body } })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="display-word">Display name</Label>
          <Input
            id="display-word"
            value={composition.productName ?? ""}
            placeholder="Used for mastheads, giant type and tapes"
            onChange={(e) => onChange({ ...composition, productName: e.target.value })}
          />
        </div>
      </section>
    </div>
  );
}

function FontSelect({
  id,
  label,
  value,
  defaultLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: FontFamily | undefined;
  defaultLabel: string;
  options: FontFamily[];
  onChange: (value: FontFamily | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(isFontFamily(e.target.value) ? e.target.value : undefined)}
        className="h-9 rounded-md border bg-background px-2 text-sm"
        style={value ? { fontFamily: `"${value}"` } : undefined}
      >
        <option value="">{defaultLabel}</option>
        {options.map((family) => (
          <option key={family} value={family} style={{ fontFamily: `"${family}"` }}>
            {family}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Every template, rendered live with *this* poster's content and colours.
 *
 * Thumbnails are real recompositions, not stock screenshots — what the
 * client sees in the grid is exactly what they'll get on click. Memoised
 * on the composition so typing in the content tab doesn't re-render 25
 * posters per keystroke more than React has to.
 */
const TemplateGallery = memo(function TemplateGallery({
  schema,
  composition,
  selectedId,
  onSelect,
}: {
  schema: DesignSchema;
  composition: PosterComposition;
  selectedId: string;
  onSelect: (templateId: string) => void;
}) {
  const thumbs = useMemo(
    () =>
      TEMPLATES.map((template) => ({
        template,
        schema: recomposePoster(schema, {
          ...composition,
          style: { ...composition.style, templateId: template.id },
        }),
      })),
    [schema, composition],
  );

  return (
    <div className="grid max-h-[460px] grid-cols-3 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-4">
      {thumbs.map(({ template, schema: thumb }) => {
        const selected = template.id === selectedId;
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            aria-pressed={selected}
            className={cn(
              "group relative flex flex-col gap-1 rounded-lg p-1 text-left transition",
              selected ? "bg-foreground/10 ring-2 ring-foreground" : "hover:bg-muted",
            )}
          >
            <div className="pointer-events-none">
              <DesignCanvasPreview schema={thumb} maxWidth={200} />
            </div>
            <span className="truncate px-0.5 text-[11px] font-medium">{template.name}</span>
            {selected && (
              <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="size-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
