"use client";

import { memo, useDeferredValue, useMemo } from "react";
import Link from "next/link";
import { Shuffle, RotateCcw, Check, Stamp } from "lucide-react";
import {
  applyBrandFonts,
  applyBrandStyle,
  applyProductColors,
  currentColorSource,
  type BrandKit,
} from "@/lib/brand/kit";
import type { DesignSchema } from "@/lib/design-schema/types";
import { BODY_FONTS, FONT_FAMILIES, isFontFamily, type FontFamily } from "@/lib/design-schema/fontRegistry";
import { recomposePoster, type PosterComposition } from "@/lib/orchestration/composition";
import { PALETTES, type ColorOverrides, type ResolvedStyle } from "@/lib/orchestration/styles";
import { TEMPLATES, templateFor } from "@/lib/orchestration/templates/registry";
import { AD_FORMATS, formatDef } from "@/lib/orchestration/formats";
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

const TEXT_SIZES = [
  { label: "Compact", scale: 0.85, hint: "Fits the most" },
  { label: "Regular", scale: 1, hint: "As designed" },
  { label: "Large", scale: 1.15, hint: "Bold, fewer facts" },
];

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
  brandKit = null,
}: {
  /** The saved schema, for its images. */
  schema: DesignSchema;
  composition: PosterComposition;
  onChange: (next: PosterComposition) => void;
  brandKit?: BrandKit | null;
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
      <BrandSection composition={composition} onChange={onChange} kit={brandKit} />

      <section className="flex flex-col gap-3">
        <header>
          <h3 className="text-sm font-semibold">Size</h3>
          <p className="text-xs text-muted-foreground">
            Same design, reframed for each placement. Copy and product stay put; the background grows.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Ad size">
          {AD_FORMATS.map((f) => {
            const selected = formatDef(style.format).id === f.id;
            const box = 28;
            const w = f.width >= f.height ? box : Math.round((box * f.width) / f.height);
            const h = f.height >= f.width ? box : Math.round((box * f.height) / f.width);
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStyle({ format: f.id })}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2 text-left transition",
                  selected ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "hover:bg-muted",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center">
                  <span className="rounded-[3px] border-2 border-current opacity-70" style={{ width: w, height: h }} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">
                    {f.label} <span className="font-normal text-muted-foreground">{f.ratio}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{f.usage}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <header>
          <h3 className="text-sm font-semibold">Text size</h3>
          <p className="text-xs text-muted-foreground">
            Compact fits more specs and features on the ad. Every design also tightens its type a little before it
            ever cuts content.
          </p>
        </header>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
          {TEXT_SIZES.map((t) => {
            const on = Math.abs((style.textScale ?? 1) - t.scale) < 0.01;
            return (
              <button
                key={t.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStyle({ textScale: t.scale === 1 ? undefined : t.scale })}
                className={cn(
                  "rounded-lg border p-2 text-left transition",
                  on ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "hover:bg-muted",
                )}
              >
                <span className="block font-semibold" style={{ fontSize: 13 * t.scale }}>
                  {t.label}
                </span>
                <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

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

function BrandSection({
  composition,
  onChange,
  kit,
}: {
  composition: PosterComposition;
  onChange: (next: PosterComposition) => void;
  kit: BrandKit | null;
}) {
  if (!kit) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <Stamp className="size-3.5 shrink-0" />
        <span>
          <Link href="/brand" className="font-medium text-foreground underline underline-offset-4">
            Set up a brand kit
          </Link>{" "}
          to put your logo, colours and fonts on every ad.
        </span>
      </p>
    );
  }

  const logo = composition.logo;
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border p-3">
      <header className="flex items-center gap-2">
        <Stamp className="size-3.5" />
        <h3 className="text-sm font-semibold">Brand{kit.brandName ? ` · ${kit.brandName}` : ""}</h3>
      </header>
      {kit.colors && (
        <ColorSourceSwitch
          current={currentColorSource(composition.style, kit)}
          brandSwatch={[kit.colors.ink, kit.colors.accent]}
          productSwatch={(() => {
            const p = composition.style.productColors;
            return p ? [p.ink, p.accent] : null;
          })()}
          onBrand={() => onChange({ ...composition, style: applyBrandStyle(composition.style, kit) })}
          onProduct={() => onChange({ ...composition, style: applyBrandFonts(applyProductColors(composition.style), kit) })}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!kit.colors && (kit.headlineFont || kit.bodyFont) && (
          <Button variant="outline" size="sm" onClick={() => onChange({ ...composition, style: applyBrandFonts(composition.style, kit) })}>
            Apply brand fonts
          </Button>
        )}
        {kit.logo && !logo && (
          <Button variant="outline" size="sm" onClick={() => onChange({ ...composition, logo: kit.logo, logoHidden: false })}>
            Add logo
          </Button>
        )}
        {logo && (
          <label className="flex items-center gap-2 px-1 text-xs font-medium">
            <input
              type="checkbox"
              checked={!composition.logoHidden}
              onChange={(e) => onChange({ ...composition, logoHidden: !e.target.checked })}
            />
            Show logo
          </label>
        )}
        {logo && kit.logo && logo.src !== kit.logo.src && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...composition, logo: kit.logo, logoHidden: false })}>
            Use latest logo
          </Button>
        )}
      </div>
    </section>
  );
}

function ColorSourceSwitch({
  current,
  brandSwatch,
  productSwatch,
  onBrand,
  onProduct,
}: {
  current: "brand" | "product" | "custom";
  brandSwatch: [string, string];
  productSwatch: [string, string] | null;
  onBrand: () => void;
  onProduct: () => void;
}) {
  const options = [
    { id: "brand" as const, label: "Brand colours", hint: "Your kit, exactly", swatch: brandSwatch, onClick: onBrand },
    { id: "product" as const, label: "Product colours", hint: "Drawn from the photo", swatch: productSwatch, onClick: onProduct },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Colours">
        {options.map((o) => {
          const on = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={o.onClick}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border p-2 text-left transition",
                on ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "hover:bg-muted",
              )}
            >
              <span className="flex h-7 w-9 shrink-0 overflow-hidden rounded border">
                {o.swatch ? (
                  <>
                    <span className="flex-1" style={{ background: o.swatch[0] }} />
                    <span className="flex-1" style={{ background: o.swatch[1] }} />
                  </>
                ) : (
                  <span className="flex-1 bg-[conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)]" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{o.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {current === "custom" && (
        <p className="text-[11px] text-muted-foreground">Using custom colours from the picker below.</p>
      )}
    </div>
  );
}
