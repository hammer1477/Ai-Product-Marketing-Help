"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, FileText, Layers, Megaphone, Ratio, Sparkles, Target } from "lucide-react";
import { COPY_ANGLES, DEFAULT_CAMPAIGN_ANGLES } from "@/lib/orchestration/angles";
import { campaignCost, CAMPAIGN_STRATEGY_CREDITS, CAMPAIGN_AD_CREDITS } from "@/lib/credits/pricing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ColorSourcePicker, type ColorSourceChoice } from "@/components/brand/ColorSourcePicker";

const DELIVERABLES = [
  { icon: Target, title: "Strategy", body: "A big idea, your target audiences and the Meta interests to reach them." },
  { icon: Layers, title: "One look, several ads", body: "Every ad shares one palette and scene, each sells a different angle." },
  { icon: Ratio, title: "Every placement", body: "Each ad in square, feed, story and banner sizes." },
  { icon: Megaphone, title: "Ready-to-post copy", body: "Captions, hashtags and Meta ad text for every ad." },
  { icon: CalendarDays, title: "Rollout playbook", body: "Day-by-day plan, budget split, A/B test setup and how to pick the winner." },
  { icon: FileText, title: "One-click download", body: "All ads, all sizes and the playbook in a single zip." },
];

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
  const router = useRouter();
  const [colorSource, setColorSource] = useState<ColorSourceChoice>("brand");
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

  const cost = campaignCost(angles.length);
  const outOfCredits = error && /insufficient credits/i.test(error);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/40">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" /> Launch a full campaign
        </CardTitle>
        <CardDescription>
          What a marketing agency would hand you: the strategy, the ads, the copy and the plan to run them on
          Instagram and Facebook — built for this product in about two minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-5">
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {DELIVERABLES.map((d) => (
            <li key={d.title} className="flex gap-2.5 text-sm">
              <d.icon className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">{d.title}. </span>
                <span className="text-muted-foreground">{d.body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium">Which angles should we test?</p>
            <p className="text-xs text-muted-foreground">
              One ad per angle. Running them side by side shows you which message actually sells — then you put your
              budget behind the winner.
            </p>
          </div>
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
                    "relative rounded-lg border p-2.5 text-left transition",
                    on ? "border-foreground bg-foreground/5 ring-1 ring-foreground" : "hover:bg-muted",
                  )}
                >
                  {on && <Check className="absolute right-2 top-2 size-3.5" />}
                  <span className="block text-sm font-medium">{angle.label}</span>
                  <span className="block text-xs text-muted-foreground">{angle.blurb}</span>
                </button>
              );
            })}
          </div>
        </div>

        {brandSwatch && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Colours</span>
            <ColorSourcePicker value={colorSource} onChange={setColorSource} brandSwatch={brandSwatch} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5">
          <Button size="lg" onClick={start} disabled={disabled || busy || angles.length < 2}>
            {busy ? "Starting…" : `Launch campaign · ${cost} credits`}
          </Button>
          <span className="text-xs text-muted-foreground">
            {disabled
              ? "Confirm the product category first."
              : angles.length < 2
                ? "Pick at least two angles."
                : `${CAMPAIGN_STRATEGY_CREDITS} for strategy & playbook + ${CAMPAIGN_AD_CREDITS} per ad. Refunded automatically if it fails.`}
          </span>
        </div>
        {error && (
          <p className="text-sm text-destructive">
            {outOfCredits ? (
              <>
                Not enough credits for this campaign.{" "}
                <Link href="/credits" className="font-medium underline underline-offset-4">
                  Buy more
                </Link>{" "}
                or test fewer angles.
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
