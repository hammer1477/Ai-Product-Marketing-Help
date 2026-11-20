"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { COPY_ANGLES, DEFAULT_CAMPAIGN_ANGLES } from "@/lib/orchestration/angles";
import { GENERATION_COST_CREDITS } from "@/lib/credits/pricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ColorSourcePicker, type ColorSourceChoice } from "@/components/brand/ColorSourcePicker";

export function CampaignLauncher({
  productId,
  disabled,
  brandSwatch,
}: {
  productId: string;
  disabled?: boolean;
  /** The brand kit's [background, accent], when it has colours. */
  brandSwatch?: [string, string] | null;
}) {
  const [colorSource, setColorSource] = useState<ColorSourceChoice>("brand");
  const router = useRouter();
  const [angles, setAngles] = useState<string[]>(DEFAULT_CAMPAIGN_ANGLES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setAngles((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : current.length >= 6 ? current : [...current, id],
    );
  }

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/products/${productId}/campaign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ angles, colorSource: brandSwatch ? colorSource : undefined }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Couldn't start the campaign.");
      return;
    }
    router.push(`/campaigns/${body.campaignId}`);
  }

  const cost = angles.length * GENERATION_COST_CREDITS;
  const outOfCredits = error && /insufficient credits/i.test(error);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4" /> Campaign pack
        </CardTitle>
        <CardDescription>
          Several ads at once, each selling a different angle, each on a different design. Built for A/B testing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COPY_ANGLES.map((angle) => {
            const on = angles.includes(angle.id);
            return (
              <button
                key={angle.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(angle.id)}
                className={cn(
                  "rounded-lg border p-2.5 text-left transition",
                  on ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "hover:bg-muted",
                )}
              >
                <span className="block text-sm font-medium">{angle.label}</span>
                <span className="block text-xs text-muted-foreground">{angle.blurb}</span>
              </button>
            );
          })}
        </div>
        {brandSwatch && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Colours</span>
            <ColorSourcePicker value={colorSource} onChange={setColorSource} brandSwatch={brandSwatch} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={start} disabled={disabled || busy || angles.length < 2}>
            {busy ? "Starting…" : `Generate ${angles.length} ads (${cost} credits)`}
          </Button>
          <span className="text-xs text-muted-foreground">
            {disabled ? "Confirm the product category first." : angles.length < 2 ? "Pick at least two angles." : "Up to six angles."}
          </span>
        </div>
        {error && (
          <p className="text-sm text-destructive">
            {outOfCredits ? (
              <>
                Not enough credits for {angles.length} ads.{" "}
                <Link href="/credits" className="font-medium underline underline-offset-4">Buy more</Link> or pick fewer angles.
              </>
            ) : (
              error
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
