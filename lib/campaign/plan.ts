import { COPY_ANGLES } from "../orchestration/angles";
import { BLOCKS_SCHEMA } from "../orchestration/blocks/types";
import { CREATIVE_CONTENT_SCHEMA } from "../orchestration/types";
import { FACT_SHEET_SCHEMA } from "../orchestration/factSheet";
import { DESIGN_BRIEF_SCHEMA } from "../orchestration/designBrief";
import type { ArtDirection } from "../orchestration/types";

// The campaign plan: what a marketing agency hands a client. One strategist
// pass writes it — the strategy, one shared look, every ad's poster copy,
// the social copy to post with it, and the rollout playbook — so the ads
// read as one campaign and the client knows exactly what to do with them.

export const PLACEMENTS = [
  "instagram_feed",
  "instagram_stories",
  "instagram_reels",
  "facebook_feed",
  "facebook_stories",
  "facebook_marketplace",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_LABELS: Record<Placement, string> = {
  instagram_feed: "Instagram Feed",
  instagram_stories: "Instagram Stories",
  instagram_reels: "Instagram Reels",
  facebook_feed: "Facebook Feed",
  facebook_stories: "Facebook Stories",
  facebook_marketplace: "Facebook Marketplace",
};

export const META_CTAS = ["SHOP_NOW", "LEARN_MORE", "ORDER_NOW", "GET_OFFER", "SEND_MESSAGE", "SIGN_UP"] as const;
export const META_CTA_LABELS: Record<string, string> = {
  SHOP_NOW: "Shop now",
  LEARN_MORE: "Learn more",
  ORDER_NOW: "Order now",
  GET_OFFER: "Get offer",
  SEND_MESSAGE: "Send message",
  SIGN_UP: "Sign up",
};

export type CampaignAudience = { name: string; who: string; interests: string[]; why: string };
export type SocialCopy = {
  caption: string;
  hashtags: string[];
  primaryText: string;
  adHeadline: string;
  linkDescription: string;
  callToAction: string;
};
export type CampaignAdPlan = {
  projectId: string;
  angle: string;
  rationale: string;
  placements: Placement[];
  social: SocialCopy;
};
export type RolloutPhase = { name: string; days: string; goal: string; actions: string[]; budgetShare: number };
export type Kpi = { metric: string; target: string; why: string };
export type CalendarEntry = { day: number; platform: string; format: string; angle: string; note: string };

export type CampaignPlan = {
  strategy: {
    bigIdea: string;
    summary: string;
    keyMessage: string;
    positioning: string;
    audiences: CampaignAudience[];
  };
  look: { mood: string; why: string };
  ads: CampaignAdPlan[];
  rollout: {
    durationDays: number;
    overview: string;
    budgetAdvice: string;
    phases: RolloutPhase[];
    testSetup: string[];
    kpis: Kpi[];
    winnerRule: string;
    calendar: CalendarEntry[];
    tips: string[];
  };
};

// ---------------------------------------------------------------------------
// Schema the strategist answers in. Order matters: Gemini writes properties
// in schema order, so facts come first, then strategy, then the look, then
// ads written from all three, then the plan to run them.
// ---------------------------------------------------------------------------

const str = (description: string) => ({ type: "string", description });
const strList = (description: string, min = 1, max = 8) => ({
  type: "array",
  items: { type: "string" },
  minItems: min,
  maxItems: max,
  description,
});

const AD_SCHEMA = {
  type: "object",
  properties: {
    angle: { type: "string", enum: COPY_ANGLES.map((a) => a.id), description: "The angle this ad takes — exactly as assigned." },
    rationale: str(
      "Two sentences TO THE SELLER, plain language: why this angle should work for this product and " +
        "audience, and what result it's built to get (clicks, saves, purchases).",
    ),
    headline: CREATIVE_CONTENT_SCHEMA.properties.headline,
    productName: CREATIVE_CONTENT_SCHEMA.properties.productName,
    description: CREATIVE_CONTENT_SCHEMA.properties.description,
    sellingPoints: CREATIVE_CONTENT_SCHEMA.properties.sellingPoints,
    ctaLabel: CREATIVE_CONTENT_SCHEMA.properties.ctaLabel,
    badgeLabel: CREATIVE_CONTENT_SCHEMA.properties.badgeLabel,
    blocks: BLOCKS_SCHEMA,
    placements: {
      type: "array",
      items: { type: "string", enum: [...PLACEMENTS] },
      minItems: 1,
      maxItems: 4,
      description: "Where this ad performs best. Image-led, emotional angles suit Stories/Reels; proof and offers suit Feed.",
    },
    social: {
      type: "object",
      properties: {
        caption: str("Organic Instagram/Facebook post caption in the brand voice: a hook line, 1-3 short lines, a call to action. Emoji sparingly. No hashtags here."),
        hashtags: strList("6-10 hashtags without '#', mixing broad and niche, relevant to the product and market.", 4, 12),
        primaryText: str("Meta ad 'Primary text', max 125 characters, hook first."),
        adHeadline: str("Meta ad 'Headline', max 40 characters."),
        linkDescription: str("Meta ad 'Description', max 30 characters."),
        callToAction: { type: "string", enum: [...META_CTAS], description: "Meta ad button." },
      },
      required: ["caption", "hashtags", "primaryText", "adHeadline", "linkDescription", "callToAction"],
    },
  },
  propertyOrdering: [
    "angle", "rationale", "headline", "productName", "description", "sellingPoints", "ctaLabel", "badgeLabel",
    "blocks", "placements", "social",
  ],
  required: ["angle", "rationale", "headline", "productName", "description", "sellingPoints", "ctaLabel", "blocks", "placements", "social"],
};

export function campaignSchema(adCount: number) {
  return {
    type: "object",
    properties: {
      factSheet: { ...FACT_SHEET_SCHEMA, description: "STEP 1: everything you extracted. Written before anything else." },
      strategy: {
        type: "object",
        properties: {
          bigIdea: str("The campaign's big idea in one memorable line — the thread every ad pulls on."),
          summary: str("3-4 sentences TO THE SELLER, plain language: what this campaign does, who it targets and why it should sell."),
          keyMessage: str("The one thing a buyer should remember, in a short sentence."),
          positioning: str("One sentence: how the product is positioned against the alternatives."),
          audiences: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                name: str("Short audience name, e.g. 'Gift-hunting partners'."),
                who: str("Who they are: age range, situation, mindset. One sentence."),
                interests: strList("3-6 Meta targeting interests or behaviours to target them with.", 3, 6),
                why: str("Why they'll buy this. One sentence."),
              },
              required: ["name", "who", "interests", "why"],
            },
          },
        },
        required: ["bigIdea", "summary", "keyMessage", "positioning", "audiences"],
      },
      artDirection: { ...CREATIVE_CONTENT_SCHEMA.properties.artDirection, description: "ONE shared look for every ad in the campaign — palette and scene drawn from the product's own colours and world." },
      lookWhy: str("One sentence TO THE SELLER on why this look suits the product and audience."),
      designBrief: DESIGN_BRIEF_SCHEMA,
      ads: {
        type: "array",
        minItems: adCount,
        maxItems: adCount,
        items: AD_SCHEMA,
        description: `Exactly ${adCount} ads, one per assigned angle, in the assigned order.`,
      },
      rollout: {
        type: "object",
        properties: {
          durationDays: { type: "integer", description: "Campaign length in days, 10-21." },
          overview: str("2-3 sentences TO THE SELLER: how the campaign runs from launch to scaling the winner."),
          budgetAdvice: str("Practical daily budget advice for a small business, in the seller's currency when the price shows one, otherwise relative terms. How to split it between ads at first."),
          phases: {
            type: "array",
            minItems: 3,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                name: str("Phase name, e.g. 'Test', 'Learn', 'Scale'."),
                days: str("Day range, e.g. 'Days 1-4'."),
                goal: str("What this phase is for. One sentence."),
                actions: strList("2-4 concrete things the seller does in this phase.", 2, 4),
                budgetShare: { type: "integer", description: "Percent of total budget spent in this phase. All phases sum to 100." },
              },
              required: ["name", "days", "goal", "actions", "budgetShare"],
            },
          },
          testSetup: strList("Step-by-step A/B test setup in Meta Ads Manager, one short imperative step each, a beginner can follow.", 5, 9),
          kpis: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                metric: str("Metric name, e.g. 'CTR (link click-through rate)'."),
                target: str("A sensible target for this category, e.g. 'above 1.2%'."),
                why: str("What it tells the seller. One sentence."),
              },
              required: ["metric", "target", "why"],
            },
          },
          winnerRule: str("Exactly how to pick the winning ad and when — a rule a beginner can apply."),
          calendar: {
            type: "array",
            minItems: 5,
            maxItems: 10,
            items: {
              type: "object",
              properties: {
                day: { type: "integer", description: "Campaign day number." },
                platform: { type: "string", enum: ["Instagram", "Facebook"] },
                format: { type: "string", enum: ["Feed post", "Story", "Reel", "Carousel"] },
                angle: { type: "string", enum: COPY_ANGLES.map((a) => a.id), description: "Which campaign ad to use." },
                note: str("What to post and how, one sentence."),
              },
              required: ["day", "platform", "format", "angle", "note"],
            },
            description: "Organic posting calendar that runs alongside the paid ads.",
          },
          tips: strList("3-5 short expert tips for getting more from this campaign.", 3, 5),
        },
        required: ["durationDays", "overview", "budgetAdvice", "phases", "testSetup", "kpis", "winnerRule", "calendar", "tips"],
      },
    },
    propertyOrdering: ["factSheet", "strategy", "artDirection", "lookWhy", "designBrief", "ads", "rollout"],
    required: ["factSheet", "strategy", "artDirection", "lookWhy", "designBrief", "ads", "rollout"],
  };
}

// ---------------------------------------------------------------------------
// The model's answer, and narrowing it into a plan the UI can trust.
// ---------------------------------------------------------------------------

export type RawCampaignAd = {
  angle?: string;
  rationale?: string;
  headline?: string;
  productName?: string;
  description?: string;
  sellingPoints?: string[];
  ctaLabel?: string;
  badgeLabel?: string;
  blocks?: unknown[];
  placements?: string[];
  social?: Partial<SocialCopy>;
};

export type RawCampaign = {
  factSheet?: unknown;
  strategy?: Partial<CampaignPlan["strategy"]> & { audiences?: Partial<CampaignAudience>[] };
  artDirection?: ArtDirection;
  lookWhy?: string;
  designBrief?: unknown;
  ads?: RawCampaignAd[];
  rollout?: Partial<Omit<CampaignPlan["rollout"], "phases" | "kpis" | "calendar">> & {
    phases?: Partial<RolloutPhase>[];
    kpis?: Partial<Kpi>[];
    calendar?: Partial<CalendarEntry>[];
  };
};

const s = (v: unknown, max = 600): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max = 12): string[] =>
  Array.isArray(v) ? v.map((x) => s(x, 200)).filter(Boolean).slice(0, max) : [];

/** Matches the model's ads to the campaign's projects: by angle, then by position. */
export function matchAds(raw: RawCampaignAd[] | undefined, projects: { id: string; angle: string }[]) {
  const ads = Array.isArray(raw) ? raw : [];
  const used = new Set<number>();
  return projects.map((project, i) => {
    let idx = ads.findIndex((a, j) => !used.has(j) && a?.angle === project.angle);
    if (idx < 0) idx = !used.has(i) && ads[i] ? i : ads.findIndex((_, j) => !used.has(j));
    if (idx >= 0) used.add(idx);
    return { project, ad: idx >= 0 ? ads[idx] : undefined };
  });
}

export function normalizePlan(
  raw: RawCampaign,
  matched: { project: { id: string; angle: string }; ad?: RawCampaignAd }[],
): CampaignPlan {
  const st = raw.strategy ?? {};
  const ro = raw.rollout ?? {};
  const phases = (ro.phases ?? []).map((p) => ({
    name: s(p?.name, 40),
    days: s(p?.days, 40),
    goal: s(p?.goal, 300),
    actions: list(p?.actions, 5),
    budgetShare: Math.max(0, Math.min(100, Math.round(Number(p?.budgetShare) || 0))),
  })).filter((p) => p.name);
  // Shares the model didn't make add up to 100 are rescaled so the bars read right.
  const total = phases.reduce((a, p) => a + p.budgetShare, 0);
  if (total > 0 && total !== 100) for (const p of phases) p.budgetShare = Math.round((p.budgetShare / total) * 100);

  return {
    strategy: {
      bigIdea: s(st.bigIdea, 200),
      summary: s(st.summary, 900),
      keyMessage: s(st.keyMessage, 200),
      positioning: s(st.positioning, 300),
      audiences: (st.audiences ?? []).map((a) => ({
        name: s(a?.name, 60),
        who: s(a?.who, 300),
        interests: list(a?.interests, 8),
        why: s(a?.why, 300),
      })).filter((a) => a.name),
    },
    look: { mood: s(raw.artDirection?.moodLabel, 60), why: s(raw.lookWhy, 300) },
    ads: matched.map(({ project, ad }) => ({
      projectId: project.id,
      angle: project.angle,
      rationale: s(ad?.rationale, 500),
      placements: (ad?.placements ?? []).filter((p): p is Placement => (PLACEMENTS as readonly string[]).includes(p)),
      social: {
        caption: s(ad?.social?.caption, 1200),
        hashtags: list(ad?.social?.hashtags, 15).map((h) => h.replace(/^#/, "").replace(/\s+/g, "")),
        primaryText: s(ad?.social?.primaryText, 300),
        adHeadline: s(ad?.social?.adHeadline, 80),
        linkDescription: s(ad?.social?.linkDescription, 80),
        callToAction: (META_CTAS as readonly string[]).includes(ad?.social?.callToAction ?? "") ? ad!.social!.callToAction! : "SHOP_NOW",
      },
    })),
    rollout: {
      durationDays: Math.max(7, Math.min(30, Math.round(Number(ro.durationDays) || 14))),
      overview: s(ro.overview, 800),
      budgetAdvice: s(ro.budgetAdvice, 800),
      phases,
      testSetup: list(ro.testSetup, 12),
      kpis: (ro.kpis ?? []).map((k) => ({ metric: s(k?.metric, 80), target: s(k?.target, 80), why: s(k?.why, 300) })).filter((k) => k.metric),
      winnerRule: s(ro.winnerRule, 600),
      calendar: (ro.calendar ?? [])
        .map((c) => ({
          day: Math.max(1, Math.round(Number(c?.day) || 1)),
          platform: s(c?.platform, 20),
          format: s(c?.format, 20),
          angle: s(c?.angle, 30),
          note: s(c?.note, 300),
        }))
        .filter((c) => c.note)
        .sort((a, b) => a.day - b.day),
      tips: list(ro.tips, 6),
    },
  };
}
