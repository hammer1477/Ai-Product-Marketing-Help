"use client";

import { Lightbulb } from "lucide-react";
import type { BrandKit } from "@/lib/brand/kit";
import type { PosterComposition } from "@/lib/orchestration/composition";
import { formatDef, type AdFormat } from "@/lib/orchestration/formats";
import type { Placement } from "@/lib/campaign/plan";
import { unusedFacts } from "@/components/creative/UnusedFacts";
import { Button } from "@/components/ui/button";

// Our suggestions for this ad, as a designer sitting next to the user would
// make them. Each one is specific to this ad, most come with a one-click
// fix, and each disappears once it's been acted on — it's a conversation,
// not a checklist.

type Rec = { id: string; title: string; body: string; action?: { label: string; apply: () => void } };

const STORY_PLACEMENTS: Placement[] = ["instagram_stories", "instagram_reels", "facebook_stories"];

export function Recommendations({
  composition,
  onChange,
  hiddenTypes,
  trimmed = false,
  brandKit,
  productPrice,
  placements,
  onOpenContent,
}: {
  composition: PosterComposition;
  onChange: (next: PosterComposition) => void;
  hiddenTypes: string[];
  /** Whether the template cut items from any list. */
  trimmed?: boolean;
  brandKit: BrandKit | null;
  productPrice?: string;
  /** Where the campaign plans to run this ad, when it's a campaign ad. */
  placements?: Placement[];
  onOpenContent: () => void;
}) {
  const recs: Rec[] = [];
  const blocks = composition.blocks;
  const style = composition.style;
  const format = formatDef(style.format).id;
  const setFormat = (f: AdFormat) => onChange({ ...composition, style: { ...style, format: f } });

  if (placements?.length) {
    const forStories = placements.some((p) => STORY_PLACEMENTS.includes(p));
    const forFeed = placements.some((p) => !STORY_PLACEMENTS.includes(p));
    if (forStories && !forFeed && format !== "story") {
      recs.push({
        id: "story",
        title: "Make it a Story",
        body: "This ad is planned for Stories and Reels, which are full-screen 9:16. A square leaves half the screen empty.",
        action: { label: "Switch to 9:16", apply: () => setFormat("story") },
      });
    } else if (forFeed && format === "square") {
      recs.push({
        id: "portrait",
        title: "Take more of the feed",
        body: "A 4:5 portrait ad fills more of the screen in Instagram and Facebook feeds than a square, for the same budget.",
        action: { label: "Switch to 4:5", apply: () => setFormat("portrait") },
      });
    }
  }

  if (productPrice && !blocks.some((b) => b.type === "priceBlock")) {
    recs.push({
      id: "price",
      title: "Show your price",
      body: `Ads that show the price (${productPrice}) bring in buyers who've already decided it's worth it, so fewer clicks are wasted.`,
      action: {
        label: "Add price",
        apply: () => {
          const ctaAt = blocks.findIndex((b) => b.type === "cta");
          const at = ctaAt < 0 ? blocks.length : ctaAt;
          onChange({ ...composition, blocks: [...blocks.slice(0, at), { type: "priceBlock", value: productPrice }, ...blocks.slice(at)] });
        },
      },
    });
  }

  const headline = blocks.find((b) => b.type === "headline");
  const words = headline && "text" in headline ? headline.text.trim().split(/\s+/).filter(Boolean).length : 0;
  if (words > 8) {
    recs.push({
      id: "headline",
      title: "Shorten the headline",
      body: `It's ${words} words. People scroll past in under two seconds; 3–7 words is what reads at a glance.`,
      action: { label: "Edit content", apply: onOpenContent },
    });
  }

  const extra = unusedFacts(composition.facts, blocks).length;
  if (extra > 0) {
    recs.push({
      id: "facts",
      title: `${extra} more fact${extra === 1 ? "" : "s"} could go on this ad`,
      body: "We found more about your product than fits by default. Add the ones your buyers care about most.",
      action: { label: "See facts", apply: onOpenContent },
    });
  }

  if (hiddenTypes.length > 0 || trimmed) {
    recs.push({
      id: "hidden",
      title: "Some of your content isn't showing",
      body: "This design has no room for everything you've added. Pick a roomier template, or trim a section.",
    });
  }

  if (brandKit?.logo && !composition.logo) {
    recs.push({
      id: "logo",
      title: "Add your logo",
      body: "Ads carrying the brand mark are recognised again next time they're seen.",
      action: { label: "Add logo", apply: () => onChange({ ...composition, logo: brandKit.logo, logoHidden: false }) },
    });
  }

  if (recs.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <header className="flex items-center gap-2">
        <Lightbulb className="size-4" />
        <h3 className="text-sm font-semibold">We recommend</h3>
        <span className="text-xs text-muted-foreground">You decide. Every change is yours to undo.</span>
      </header>
      <ul className="flex flex-col gap-2">
        {recs.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 rounded-md bg-background p-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.body}</p>
            </div>
            {r.action && (
              <Button size="sm" variant="outline" onClick={r.action.apply} className="shrink-0">
                {r.action.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
