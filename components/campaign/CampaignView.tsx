import Link from "next/link";
import { Download, Lightbulb, Palette, Pencil, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { angleById } from "@/lib/orchestration/angles";
import { AD_FORMATS } from "@/lib/orchestration/formats";
import { META_CTA_LABELS, PLACEMENT_LABELS, type CampaignAdPlan, type CampaignPlan } from "@/lib/campaign/plan";
import { adCopyText } from "@/lib/campaign/playbook";
import type { ProjectCard } from "@/lib/jobs/projectStatus";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "./CopyButton";

const angleLabel = (id: string) => angleById(id)?.label ?? id;

export function CampaignView({ plan, cards }: { plan: CampaignPlan; cards: ProjectCard[] }) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="ads">Ads &amp; copy</TabsTrigger>
        <TabsTrigger value="playbook">Playbook</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="pt-4">
        <Overview plan={plan} cards={cards} />
      </TabsContent>
      <TabsContent value="ads" className="flex flex-col gap-6 pt-4">
        {plan.ads.map((ad, i) => (
          <AdPlanCard key={ad.projectId} ad={ad} index={i} card={byId.get(ad.projectId)} />
        ))}
      </TabsContent>
      <TabsContent value="playbook" className="pt-4">
        <Playbook plan={plan} />
      </TabsContent>
    </Tabs>
  );
}

function Overview({ plan, cards }: { plan: CampaignPlan; cards: ProjectCard[] }) {
  const st = plan.strategy;
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-foreground p-6 text-background sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-background/60">The big idea</p>
        <p className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{st.bigIdea}</p>
        <p className="mt-4 max-w-3xl text-background/80">{st.summary}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) =>
            c.imageUrl ? (
              <Link key={c.id} href={`/creative-projects/${c.id}`} className="group relative block overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageUrl} alt={`${angleLabel(c.angle ?? "")} ad`} className="w-full transition group-hover:opacity-90" />
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-md bg-background/90 py-1 text-xs font-medium opacity-0 transition group-hover:opacity-100">
                  <Palette className="size-3" /> Customize
                </span>
              </Link>
            ) : null,
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          These are your ads, not ours. Open any one to change the words, specs, colours, fonts or layout — we&apos;ll
          suggest improvements as you go.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Key message" body={st.keyMessage} />
        <InfoCard title="Positioning" body={st.positioning} />
        <InfoCard title={`The look${plan.look.mood ? ` · ${plan.look.mood}` : ""}`} body={plan.look.why} />
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Target className="size-4" /> Who we&apos;re targeting
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {st.audiences.map((a) => (
            <Card key={a.name}>
              <CardHeader>
                <CardTitle className="text-base">{a.name}</CardTitle>
                <CardDescription>{a.who}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p>{a.why}</p>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Target these interests in Meta</p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.interests.map((i) => (
                      <Badge key={i} variant="outline">{i}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1.5 text-sm">{body}</p>
    </div>
  );
}

function AdPlanCard({ ad, index, card }: { ad: CampaignAdPlan; index: number; card?: ProjectCard }) {
  const s = ad.social;
  const post = `${s.caption}\n\n${s.hashtags.map((h) => `#${h}`).join(" ")}`;
  return (
    <Card>
      <CardContent className="grid gap-6 py-2 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="flex flex-col gap-3">
          {card?.imageUrl ? (
            <Link href={`/creative-projects/${ad.projectId}`} className="group relative block overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.imageUrl} alt={`${angleLabel(ad.angle)} ad`} className="w-full transition group-hover:opacity-90" />
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium opacity-0 transition group-hover:opacity-100">
                <Pencil className="size-3" /> Edit
              </span>
            </Link>
          ) : (
            <div className="aspect-square rounded-lg border bg-muted" />
          )}
          <Button render={<Link href={`/creative-projects/${ad.projectId}`} />} nativeButton={false} className="w-full gap-1.5">
            <Palette className="size-4" /> Customize this ad
          </Button>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Download</p>
            <div className="grid grid-cols-2 gap-1.5">
              {AD_FORMATS.map((f) => (
                <a
                  key={f.id}
                  href={`/api/creative-projects/${ad.projectId}/export?format=png&scale=2&size=${f.id}`}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                >
                  <Download className="size-3" />
                  {f.label} <span className="text-muted-foreground">{f.ratio}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Ad {index + 1}</span>
              <h3 className="text-lg font-semibold">{angleLabel(ad.angle)}</h3>
            </div>
            <p className="mt-1 text-sm">{ad.rationale}</p>
            {ad.placements.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Run it on</span>
                {ad.placements.map((p) => (
                  <Badge key={p} variant="secondary">{PLACEMENT_LABELS[p]}</Badge>
                ))}
              </div>
            )}
          </div>

          <section className="rounded-lg border">
            <header className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold">Post on Instagram / Facebook</span>
              <CopyButton text={post} label="Copy post" />
            </header>
            <div className="px-3 py-2.5 text-sm">
              <p className="whitespace-pre-line">{s.caption}</p>
              <p className="mt-2 text-sm text-sky-700 dark:text-sky-400">{s.hashtags.map((h) => `#${h}`).join(" ")}</p>
            </div>
          </section>

          <section className="rounded-lg border">
            <header className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold">Paste into Meta Ads Manager</span>
              <CopyButton text={adCopyText(ad)} label="Copy all" />
            </header>
            <dl className="divide-y text-sm">
              {[
                ["Primary text", s.primaryText],
                ["Headline", s.adHeadline],
                ["Description", s.linkDescription],
                ["Button", META_CTA_LABELS[s.callToAction] ?? s.callToAction],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-3 px-3 py-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 flex-1">{v}</dd>
                  <CopyButton text={v} className="shrink-0" />
                </div>
              ))}
            </dl>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function Playbook({ plan }: { plan: CampaignPlan }) {
  const ro = plan.rollout;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Your {ro.durationDays}-day rollout</h3>
        <p className="text-sm">{ro.overview}</p>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="font-medium">Budget: </span>
          {ro.budgetAdvice}
        </div>
        <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-muted">
          {ro.phases.map((p, i) => (
            <div
              key={p.name}
              className="h-full border-r-2 border-background last:border-r-0"
              style={{ width: `${p.budgetShare}%`, background: `color-mix(in oklab, var(--foreground) ${90 - i * 25}%, transparent)` }}
              title={`${p.name}: ${p.budgetShare}% of budget`}
            />
          ))}
        </div>
        <ol className="grid gap-3 md:grid-cols-3">
          {ro.phases.map((p, i) => (
            <li key={p.name} className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">
                  {i + 1}. {p.name}
                </span>
                <span className="text-xs text-muted-foreground">{p.days}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.budgetShare}% of budget</p>
              <p className="mt-2 text-sm">{p.goal}</p>
              <ul className="mt-2 list-disc pl-4 text-sm text-muted-foreground">
                {p.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">Set up the A/B test in Meta Ads Manager</h3>
          <ol className="flex flex-col gap-2">
            {ro.testSetup.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold">What to watch</h3>
          <div className="overflow-hidden rounded-lg border">
            {ro.kpis.map((k) => (
              <div key={k.metric} className="border-b px-3 py-2.5 text-sm last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{k.metric}</span>
                  <span className="shrink-0 text-xs font-semibold">{k.target}</span>
                </div>
                <p className="text-xs text-muted-foreground">{k.why}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Trophy className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-medium">Picking the winner: </span>
              {ro.winnerRule}
            </p>
          </div>
        </div>
      </section>

      {ro.calendar.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Organic posting calendar</h3>
          <p className="text-sm text-muted-foreground">Free posts to run alongside the paid ads, using the campaign&apos;s own creatives.</p>
          <ol className="divide-y rounded-lg border">
            {ro.calendar.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <span className="w-14 shrink-0 font-semibold">Day {c.day}</span>
                <Badge variant="outline">{c.platform} · {c.format}</Badge>
                <Badge variant="secondary">{angleLabel(c.angle)} ad</Badge>
                <span className="min-w-0 flex-1 text-muted-foreground">{c.note}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {ro.tips.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4" /> Pro tips
          </h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {ro.tips.map((t) => (
              <li key={t} className="rounded-lg border p-3 text-sm">{t}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
