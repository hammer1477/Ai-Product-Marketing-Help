"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PHOTO_SCENES } from "@/lib/photoshoot/scenes";
import { AD_FORMATS, type AdFormat } from "@/lib/orchestration/formats";
import { PHOTOSHOOT_COST_CREDITS } from "@/lib/credits/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MAX_SHOTS = 8;

export function PhotoshootStudio({ productId, defaultFormat }: { productId: string; defaultFormat: AdFormat }) {
  const router = useRouter();
  const [scenes, setScenes] = useState<string[]>(["marble", "studio", "wood"]);
  const [custom, setCustom] = useState("");
  const [format, setFormat] = useState<AdFormat>(defaultFormat);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = scenes.length + (custom.trim() ? 1 : 0);

  function toggle(id: string) {
    setScenes((s) => (s.includes(id) ? s.filter((x) => x !== id) : count >= MAX_SHOTS ? s : [...s, id]));
  }

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/photoshoot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenes, custom, format }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't start the photoshoot.");
      return;
    }
    setCustom("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {PHOTO_SCENES.map((scene) => {
          const on = scenes.includes(scene.id);
          return (
            <button
              key={scene.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(scene.id)}
              className={cn(
                "relative flex h-20 items-end overflow-hidden rounded-lg border p-2 text-left text-xs font-semibold text-white transition",
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

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy || count === 0}>
          {busy ? "Starting…" : `Shoot ${count} photo${count === 1 ? "" : "s"} (${count * PHOTOSHOOT_COST_CREDITS} credits)`}
        </Button>
        <span className="text-xs text-muted-foreground">
          Up to {MAX_SHOTS} at a time. Your real product photo is used; only the scene is AI.
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
