"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp } from "lucide-react";
import type { BrandKit } from "@/lib/brand/kit";
import { BODY_FONTS, FONT_FAMILIES } from "@/lib/design-schema/fontRegistry";
import { PALETTES } from "@/lib/orchestration/styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBrandKit, type SaveBrandState } from "./actions";

const COLOR_FIELDS = [
  { key: "ink", label: "Background" },
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Body text" },
] as const;

const VOICE_EXAMPLES = [
  "Warm, playful, lots of personality",
  "Premium and understated. No exclamation marks.",
  "Clinical and science-led, cite numbers",
  "Bold, punchy, street",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save brand kit"}
    </Button>
  );
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function BrandKitForm({ kit }: { kit: BrandKit | null }) {
  const [state, formAction] = useActionState<SaveBrandState, FormData>(saveBrandKit, {});
  const [useColors, setUseColors] = useState(Boolean(kit?.colors));
  const [colors, setColors] = useState(
    kit?.colors ?? { ink: PALETTES[0].ink, accent: PALETTES[0].accent, text: PALETTES[0].text, muted: PALETTES[0].muted },
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(kit?.logo?.src ?? null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [voice, setVoice] = useState(kit?.voice ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* Identity */}
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brandName">Brand name</Label>
          <Input id="brandName" name="brandName" defaultValue={kit?.brandName ?? ""} maxLength={60} placeholder="e.g. Lumen Skincare" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input id="tagline" name="tagline" defaultValue={kit?.tagline ?? ""} maxLength={120} placeholder="e.g. Glow, simplified." />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="voice">Brand voice</Label>
          <Textarea
            id="voice"
            name="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="How should your ads sound?"
          />
          <div className="flex flex-wrap gap-1.5">
            {VOICE_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setVoice(example)}
                className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Logo */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Logo</h3>
          <p className="text-xs text-muted-foreground">
            Placed in the emptiest corner of every ad. A transparent PNG or SVG works best; plain backgrounds are removed automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-40 items-center justify-center rounded-lg border bg-[conic-gradient(#e5e5e5_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px] p-2">
            {logoPreview && !removeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              <ImageUp className="size-4" />
              {logoPreview ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLogoPreview(URL.createObjectURL(file));
                    setRemoveLogo(false);
                  }
                }}
              />
            </label>
            {kit?.logo && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} />
                Remove logo
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Colours */}
      <section className="flex flex-col gap-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="useColors"
            checked={useColors}
            onChange={(e) => setUseColors(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold">Use brand colours</span>
            <span className="block text-xs text-muted-foreground">
              Off: the AI picks colours from each product photo. On: every ad uses your palette.
            </span>
          </span>
        </label>
        <div className={useColors ? "flex flex-col gap-3" : "pointer-events-none flex flex-col gap-3 opacity-40"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex flex-col gap-1.5 text-xs font-medium">
                {label}
                <span className="flex items-center gap-2 rounded-md border bg-background p-1.5">
                  <input
                    type="color"
                    name={key}
                    value={colors[key]}
                    onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                    className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">{colors[key]}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((pal) => (
              <button
                key={pal.name}
                type="button"
                title={pal.name}
                aria-label={`${pal.name} palette`}
                onClick={() => setColors({ ink: pal.ink, accent: pal.accent, text: pal.text, muted: pal.muted })}
                className="flex h-7 w-11 overflow-hidden rounded-md border"
              >
                <span className="flex-1" style={{ background: pal.ink }} />
                <span className="flex-1" style={{ background: pal.accent }} />
              </button>
            ))}
          </div>
          {/* A tiny swatch of how the palette reads. */}
          <div className="flex items-center gap-4 rounded-lg p-4" style={{ background: colors.ink }}>
            <div className="flex-1">
              <p className="text-base font-semibold" style={{ color: colors.text }}>Your headline here</p>
              <p className="text-xs" style={{ color: colors.muted }}>Supporting copy in the body colour.</p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: colors.accent, color: colors.ink }}>
              Shop now
            </span>
          </div>
        </div>
      </section>

      {/* Fonts */}
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="headlineFont">Headline font</Label>
          <select id="headlineFont" name="headlineFont" defaultValue={kit?.headlineFont ?? ""} className={selectClass}>
            <option value="">Let each template choose</option>
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bodyFont">Body font</Label>
          <select id="bodyFont" name="bodyFont" defaultValue={kit?.bodyFont ?? ""} className={selectClass}>
            <option value="">Let each template choose</option>
            {BODY_FONTS.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </div>
      </section>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Brand kit saved. New ads will use it.</p>}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
