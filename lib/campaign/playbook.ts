import { angleById } from "../orchestration/angles";
import { META_CTA_LABELS, PLACEMENT_LABELS, type CampaignAdPlan, type CampaignPlan } from "./plan";

// The campaign plan as documents for the download: the playbook to follow,
// and each ad's copy ready to paste.

const label = (angle: string) => angleById(angle)?.label ?? angle;

export function adFileStem(ad: CampaignAdPlan, index: number): string {
  return `${String(index + 1).padStart(2, "0")}-${ad.angle}`;
}

export function adCopyText(ad: CampaignAdPlan): string {
  const s = ad.social;
  return [
    `AD: ${label(ad.angle)}`,
    "",
    `Why this ad: ${ad.rationale}`,
    `Run it on: ${ad.placements.map((p) => PLACEMENT_LABELS[p]).join(", ")}`,
    "",
    "── Instagram / Facebook post ──",
    s.caption,
    "",
    s.hashtags.map((h) => `#${h}`).join(" "),
    "",
    "── Meta Ads Manager ──",
    `Primary text:  ${s.primaryText}`,
    `Headline:      ${s.adHeadline}`,
    `Description:   ${s.linkDescription}`,
    `Button:        ${META_CTA_LABELS[s.callToAction] ?? s.callToAction}`,
    "",
  ].join("\n");
}

export function playbookMarkdown(plan: CampaignPlan, productName: string): string {
  const { strategy: st, rollout: ro } = plan;
  const out: string[] = [];
  out.push(`# Campaign playbook — ${productName}`, "");
  out.push(`## The big idea`, "", `**${st.bigIdea}**`, "", st.summary, "");
  out.push(`**Key message:** ${st.keyMessage}`, "", `**Positioning:** ${st.positioning}`, "");
  if (plan.look.why) out.push(`**The look (${plan.look.mood}):** ${plan.look.why}`, "");

  out.push(`## Who we're targeting`, "");
  for (const a of st.audiences) {
    out.push(`### ${a.name}`, a.who, "", `Why they'll buy: ${a.why}`, "", `Meta interests to target: ${a.interests.join(", ")}`, "");
  }

  out.push(`## The ads`, "");
  plan.ads.forEach((ad, i) => {
    out.push(`### ${i + 1}. ${label(ad.angle)}`, ad.rationale, "", `Run it on: ${ad.placements.map((p) => PLACEMENT_LABELS[p]).join(", ")}`, "");
    out.push(`Files: \`${adFileStem(ad, i)}-*.png\` · copy in \`${adFileStem(ad, i)}-copy.txt\``, "");
  });

  out.push(`## Rollout — ${ro.durationDays} days`, "", ro.overview, "", `**Budget:** ${ro.budgetAdvice}`, "");
  for (const p of ro.phases) {
    out.push(`### ${p.name} · ${p.days} · ${p.budgetShare}% of budget`, p.goal, "", ...p.actions.map((a) => `- ${a}`), "");
  }

  out.push(`## Setting up the A/B test in Meta Ads Manager`, "", ...ro.testSetup.map((s, i) => `${i + 1}. ${s}`), "");
  out.push(`## What to watch`, "", "| Metric | Target | What it tells you |", "|---|---|---|");
  for (const k of ro.kpis) out.push(`| ${k.metric} | ${k.target} | ${k.why} |`);
  out.push("", `## Picking the winner`, "", ro.winnerRule, "");

  if (ro.calendar.length) {
    out.push(`## Organic posting calendar`, "", "| Day | Where | Format | Ad | What to post |", "|---|---|---|---|---|");
    for (const c of ro.calendar) out.push(`| ${c.day} | ${c.platform} | ${c.format} | ${label(c.angle)} | ${c.note} |`);
    out.push("");
  }
  if (ro.tips.length) out.push(`## Pro tips`, "", ...ro.tips.map((t) => `- ${t}`), "");
  return out.join("\n");
}
