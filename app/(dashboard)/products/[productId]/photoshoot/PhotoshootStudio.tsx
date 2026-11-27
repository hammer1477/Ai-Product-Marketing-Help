"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { PHOTO_SCENES } from "@/lib/photoshoot/scenes";
import type { SceneIdea } from "@/lib/photoshoot/suggest";
import { AD_FORMATS, type AdFormat } from "@/lib/orchestration/formats";
import { PHOTOSHOOT_COST_CREDITS } from "@/lib/credits/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_SHOTS = 8;

type Framing = "hero" | "closeup" | "thirds" | "variety";

const FRAMINGS: Array<{ id: Framing; label: string; hint: string; preview: ReactNode }> = [
  { id: "hero", label: "Hero", hint: "Centred, big", preview: <span className="absolute bottom-2 left-1/2 h-7 w-7 -translate-x-1/2 rounded-md bg-current" /> },
  { id: "closeup", label: "Close-up", hint: "Fills the frame", preview: <span className="absolute bottom-1 left-1/2 h-10 w-11 -translate-x-1/2 rounded-md bg-current" /> },
  { id: "thirds", label: "Off-centre", hint: "Room beside it", preview: <span className="absolute bottom-2 left-[22%] h-7 w-6 rounded-md bg-current" /> },
  {
    id: "variety",
    label: "Variety",
    hint: "Mix all three",
    preview: (
      <>
        <span className="absolute bottom-2 left-[12%] h-4 w-3 rounded-sm bg-current" />
        <span className="absolute bottom-2 left-1/2 h-7 w-5 -translate-x-1/2 rounded-sm bg-current" />
        <span className="absolute bottom-2 right-[12%] h-5 w-4 rounded-sm bg-current" />
      </>
    ),
  },
];

export function PhotoshootStudio({
  productId,
  defaultFormat,
  initialIdeas,
}: {
  productId: string;
  defaultFormat: AdFormat;
  /** Scene ideas the AI already wrote for this product. */
  initialIdeas: SceneIdea[];
}) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<SceneIdea[]>(initialIdeas);
  const [pickedIdeas, setPickedIdeas] = useState<string[]>([]);
  // With ideas to choose from, presets start unpicked so the AI's picks lead.
  const [scenes, setScenes] = useState<string[]>(initialIdeas.length ? [] : ["marble", "studio", "wood"]);
  const [custom, setCustom] = useState("");
  const [format, setFormat] = useState<AdFormat>(defaultFormat);
  const [framing, setFraming] = useState<Framing>("hero");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = pickedIdeas.length + scenes.length + (custom.trim() ? 1 : 0);
  const full = count >= MAX_SHOTS;

  function togglePreset(id: string) {
    setScenes((s) => (s.includes(id) ? s.filter((x) => x !== id) : full ? s : [...s, id]));
  }
  function toggleIdea(title: string) {
    setPickedIdeas((s) => (s.includes(title) ? s.filter((x) => x !== title) : full ? s : [...s, title]));
  }

  async function suggest(more: boolean) {
    setThinking(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/photoshoot/suggest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ more }),
    });
    const body = await res.json().catch(() => ({}));
    setThinking(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't come up with ideas right now.");
      return;
    }
    setIdeas(body.ideas);
    if (!more) setPickedIdeas([]);
  }

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/photoshoot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenes,
        custom,
        format,
        framing,
        ideas: ideas.filter((i) => pickedIdeas.includes(i.title)).map((i) => ({ title: i.title, prompt: i.prompt })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't start the photoshoot.");
      return;
    }
    setCustom("");
    setPickedIdeas([]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* AI ideas for this product */}
      <section className="flex flex-col gap-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4" /> Scenes made for this product
            </h3>
            <p className="text-xs text-muted-foreground">
              Our art director studies your product — its materials, colours, buyer and use — and proposes sets to
              shoot it in. Free.
            </p>
          </div>
          {ideas.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => suggest(true)} disabled={thinking} className="gap-1.5">
              {thinking ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              More ideas
            </Button>
          )}
        </header>

        {ideas.length === 0 ? (
          <button
            type="button"
            onClick={() => suggest(false)}
            disabled={thinking}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-sm font-medium transition hover:bg-muted disabled:opacity-70"
          >
            {thinking ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Studying your product and sketching scenes…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Suggest scenes for my product
              </>
            )}
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => {
              const on = pickedIdeas.includes(idea.title);
              return (
                <button
                  key={idea.title}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleIdea(idea.title)}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-xl border text-left transition",
                    on ? "border-foreground ring-2 ring-foreground" : "hover:border-foreground/40",
                  )}
                >
                  <span
                    className="relative flex h-14 items-end px-3 pb-2"
                    style={{ background: `linear-gradient(135deg, ${idea.swatch[0]}, ${idea.swatch[1]})` }}
                  >
                    <span className="rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-medium">{idea.bestFor}</span>
                    {on && (
                      <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                        <Check className="size-3" />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-sm font-semibold">{idea.title}</span>
                    <span className="text-xs text-muted-foreground">{idea.why}</span>
                    <span className="mt-1 line-clamp-3 text-[11px] italic text-muted-foreground/80" title={idea.prompt}>
                      {idea.prompt}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Presets */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Classic sets</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {PHOTO_SCENES.map((scene) => {
            const on = scenes.includes(scene.id);
            return (
              <button
                key={scene.id}
                type="button"
                aria-pressed={on}
                onClick={() => togglePreset(scene.id)}
                className={cn(
                  "relative flex h-16 items-end overflow-hidden rounded-lg border p-2 text-left text-xs font-semibold text-white transition",
                  on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100",
                )}
                style={{ background: scene.swatch }}
              >
                <span className="drop-shadow">{scene.label}</span>
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-white text-black">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Label htmlFor="custom-scene">Or describe your own scene</Label>
        <Input
          id="custom-scene"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={300}
          placeholder="e.g. on a café table in Paris, croissant blurred behind, morning light"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Framing</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FRAMINGS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={framing === f.id}
              onClick={() => setFraming(f.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-2 text-left transition",
                framing === f.id ? "border-foreground ring-2 ring-foreground" : "hover:border-foreground/40",
              )}
            >
              <span className="relative h-12 w-14 shrink-0 overflow-hidden rounded-md bg-muted text-foreground/70">
                <span className="absolute inset-x-0 bottom-0 h-3 bg-foreground/10" />
                {f.preview}
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold">{f.label}</span>
                <span className="text-[11px] text-muted-foreground">{f.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Size</span>
        <div className="flex flex-wrap gap-2">
          {AD_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs",
                format === f.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {f.label} {f.ratio}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button onClick={start} disabled={busy || count === 0}>
          {busy ? "Starting…" : `Shoot ${count} photo${count === 1 ? "" : "s"} (${count * PHOTOSHOOT_COST_CREDITS} credits)`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {full ? `That's the most for one shoot (${MAX_SHOTS}).` : `Pick up to ${MAX_SHOTS}.`} Your real product photo is used;
          only the scene is AI.
        </span>
      </div>
      {error && (
        <p className="text-sm text-destructive">
          {/insufficient credits/i.test(error) ? (
            <>
              Not enough credits.{" "}
              <Link href="/credits" className="font-medium underline underline-offset-4">
                Buy more
              </Link>{" "}
              or pick fewer scenes.
            </>
          ) : (
            error
          )}
        </p>
      )}
    </div>
  );
}
