import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Camera,
  Check,
  Eye,
  Heart,
  Layers,
  LineChart,
  Megaphone,
  Palette,
  PenLine,
  Ratio,
  ShieldCheck,
  Smile,
  Sparkles,
  Stamp,
  Target,
  Undo2,
  Wand2,
} from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { CREDIT_PACKS, formatPrice, generationsIn } from "@/lib/credits/packs";
import { CAMPAIGN_AD_CREDITS, CAMPAIGN_STRATEGY_CREDITS, GENERATION_COST_CREDITS, PHOTOSHOOT_COST_CREDITS } from "@/lib/credits/pricing";
import { BrandMark } from "@/components/theme/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const SIGNUP_CREDITS = 20;

const TEAM = [
  {
    icon: Eye,
    role: "Product Analyst",
    body: "Reads every word on your packaging, names your materials like a buyer would, and builds the fact sheet everything else stands on.",
  },
  {
    icon: PenLine,
    role: "Creative Director",
    body: "Finds the one idea that sells your product, writes headlines that stop the scroll, and art-directs the palette from your product's own colours.",
  },
  {
    icon: Target,
    role: "Campaign Strategist",
    body: "Plans who to reach, what to say to them and how to run it on Instagram & Facebook — then shows you how to find the winning ad.",
  },
  {
    icon: Camera,
    role: "Photo Director",
    body: "Designs sets around your product — the surface, the light, the props — so every shot looks like an expensive studio day.",
  },
];

const POSITIVES = [
  "No design skills needed",
  "Your real product, never altered",
  "Ready in about a minute",
  "Every placement, every size",
  "Credits never expire",
  "Failed jobs refunded automatically",
];

const FAQ = [
  {
    q: "Do I need any design or marketing experience?",
    a: "None. Your AI team does the strategy, copy, design and photography — and explains every choice in plain language. You can change anything, but you never have to.",
  },
  {
    q: "Will the AI change how my product looks?",
    a: "Never. Your uploaded photo goes into every ad and photoshoot exactly as it is. AI only creates the background, the set and the words around it.",
  },
  {
    q: "What's in a campaign?",
    a: "A strategy and big idea, target audiences with the Meta interests to reach them, several ads in one shared look (each testing a different message), ready-to-post captions and Meta ad text, a rollout playbook with budget split and A/B test setup — and a zip with every ad in every size.",
  },
  {
    q: "Can I edit what the AI makes?",
    a: "Every word, spec, colour, font, layout and size. Add new sections, reorder them, undo anything. We'll suggest improvements as you go — you decide.",
  },
  {
    q: "How do credits work?",
    a: `One ad is ${GENERATION_COST_CREDITS} credits, a photoshoot photo is ${PHOTOSHOOT_COST_CREDITS}, and a campaign is ${CAMPAIGN_STRATEGY_CREDITS} for the strategy plus ${CAMPAIGN_AD_CREDITS} per ad. Editing, resizing, scene ideas and downloads are free. No subscription.`,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BrandMark />
            AI Advertising Studio
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {[
              ["#team", "Your team"],
              ["#campaigns", "Campaigns"],
              ["#photoshoot", "Photoshoot"],
              ["#pricing", "Pricing"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground md:inline">
                {label}
              </a>
            ))}
            <ThemeToggle />
            <Link href="/login" className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-muted">
              Log in
            </Link>
            <Link href="/signup" className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative">
          <Glow className="-top-40 left-[-10%] size-[620px]" color="var(--brand-1)" />
          <Glow className="top-10 right-[-12%] size-[560px]" color="var(--brand-2)" delay />
          <Glow className="top-[380px] left-[35%] size-[420px]" color="var(--brand-3)" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 md:pt-24 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col items-start gap-7">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur">
                <Sparkles className="size-3.5 text-[var(--brand-2)]" />
                {SIGNUP_CREDITS} free credits · no card needed
              </span>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                Your whole creative team,
                <br />
                <span className="text-brand">from one photo.</span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Upload a product photo. An AI analyst, creative director, strategist and photographer turn it into
                scroll-stopping ads, full Instagram & Facebook campaigns and studio-grade photoshoots — in about a
                minute.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-semibold text-white shadow-lg ring-brand transition hover:scale-[1.02]"
                >
                  Make something beautiful <ArrowRight className="size-4" />
                </Link>
                <a href="#work" className="rounded-full border bg-background/60 px-6 py-3 text-base font-medium backdrop-blur hover:bg-muted">
                  See the work
                </a>
              </div>
              <ul className="flex flex-wrap gap-2">
                {POSITIVES.slice(0, 3).map((p) => (
                  <li key={p} className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-xs font-medium">
                    <Check className="size-3.5 text-emerald-500" /> {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto h-[520px] w-full max-w-[540px]">
              <FloatCard className="left-0 top-6 w-[52%] -rotate-6" src="/showcase/coffee.webp" w={1080} h={1080} alt="Coffee ad" priority />
              <FloatCard className="right-0 top-0 w-[44%] rotate-6" src="/showcase/buds-story.webp" w={1080} h={1920} alt="Earbuds story ad" priority delay />
              <FloatCard className="bottom-0 left-[18%] w-[50%] rotate-2" src="/showcase/shoot-travertine.webp" w={1080} h={1350} alt="Serum photoshoot" />
              <div className="absolute bottom-24 right-2 z-20 flex items-center gap-2 rounded-2xl border bg-background/90 px-3 py-2 text-xs font-medium shadow-xl backdrop-blur">
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Check className="size-3.5" />
                </span>
                Campaign ready · 4 ads · playbook
              </div>
            </div>
          </div>
        </section>

        {/* Positives marquee */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5">
            {POSITIVES.map((p) => (
              <span key={p} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Heart className="size-3.5 text-[var(--brand-2)]" /> {p}
              </span>
            ))}
          </div>
        </section>

        {/* Team */}
        <section id="team" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <Heading
            eyebrow="Meet your team"
            title={<>Four experts. <span className="text-brand">Zero salaries.</span></>}
            body="Every time you press generate, a team trained on how the best in each field work gets to it — and checks its own work before you see it."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((t, i) => (
              <div key={t.role} className="group relative overflow-hidden rounded-3xl border bg-card p-6 transition hover:-translate-y-1 hover:ring-brand">
                <div
                  aria-hidden
                  className="absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
                  style={{ background: `var(--brand-${(i % 3) + 1})` }}
                />
                <span className="relative flex size-11 items-center justify-center rounded-2xl bg-brand text-white">
                  <t.icon className="size-5" />
                </span>
                <h3 className="relative mt-5 text-lg font-semibold">{t.role}</h3>
                <p className="relative mt-2 text-sm text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ads */}
        <section id="work" className="relative border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <Heading
              eyebrow="Ads in a minute"
              title="Different products. Genuinely different designs."
              body="28 designer templates — from bold posters to spec sheets that hold every fact. Every one of these came straight out of the studio."
            />
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["/showcase/coffee.webp", "Coffee ad"],
                ["/showcase/buds.webp", "Earbuds ad"],
                ["/showcase/candle.webp", "Candle ad"],
                ["/showcase/bottle.webp", "Bottle ad"],
              ].map(([src, alt], i) => (
                <div key={src} className={cn("overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-1 hover:ring-brand", i % 2 && "md:translate-y-8")}>
                  <Image src={src} alt={alt} width={1080} height={1080} sizes="(min-width: 768px) 25vw, 50vw" className="h-auto w-full" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Campaigns */}
        <section id="campaigns" className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <Pill icon={Megaphone}>Agency campaigns</Pill>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                The campaign an agency would hand you. <span className="text-brand">In two minutes.</span>
              </h2>
              <p className="text-muted-foreground">
                Pick the angles you want to test. Your strategist writes the big idea, picks your audiences, designs
                every ad in one shared look, writes the captions and Meta ad text — and hands you the playbook to run it.
              </p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  [Target, "Strategy, audiences & Meta interests"],
                  [Layers, "Several ads, one look, different messages"],
                  [Megaphone, "Captions, hashtags & ad text, copy-ready"],
                  [LineChart, "Rollout, budget split & A/B test setup"],
                  [Ratio, "Every ad in every size"],
                  [Check, "One-click zip of everything"],
                ].map(([Icon, label]) => {
                  const I = Icon as typeof Target;
                  return (
                    <li key={label as string} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-brand text-white">
                        <I className="size-3" />
                      </span>
                      {label as string}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* A taste of the deliverable */}
            <div className="relative">
              <Glow className="-inset-10" color="var(--brand-1)" />
              <div className="relative rounded-3xl border bg-card p-5 shadow-2xl">
                <div className="rounded-2xl bg-brand p-5 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">The big idea</p>
                  <p className="mt-1.5 text-xl font-semibold leading-snug">Glow that shows up by Friday.</p>
                  <p className="mt-2 text-sm text-white/85">Lead with the visible result, prove it with 15% vitamin C, win the 7-day skeptic.</p>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {["serum-square", "serum-portrait", "serum-story", "serum-landscape"].map((s) => (
                    <Image key={s} src={`/showcase/${s}.webp`} alt="" width={540} height={540} className="aspect-square w-full rounded-lg border object-cover" />
                  ))}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs font-semibold">Phase plan</p>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full">
                      <span className="w-[30%] bg-[var(--brand-1)]" />
                      <span className="w-[30%] bg-[var(--brand-2)]" />
                      <span className="w-[40%] bg-[var(--brand-3)]" />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Test · Optimise · Scale the winner</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs font-semibold">Ready to paste</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      &ldquo;Brighter skin in seven days — or you&apos;ll see why everyone asks what you changed.&rdquo;
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--brand-1)]">#vitaminc #skincareroutine #glow</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Photoshoot */}
        <section id="photoshoot" className="relative border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
              <div className="flex flex-col gap-5">
                <Pill icon={Camera}>AI photoshoot</Pill>
                <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  A studio day, <span className="text-brand">without the studio.</span>
                </h2>
                <p className="text-muted-foreground">
                  Your photo director studies your product and suggests sets made for it — the surface, the light, the
                  props. Pick your favourites and get lifestyle photos for your store, socials and listings.
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    ["Sunlit travertine", "Warm stone flatters amber glass — perfect product-page hero."],
                    ["Ripple & pebble", "Fresh, clean and scroll-stopping for Stories."],
                    ["Amber spotlight", "Moody luxury that makes it feel twice the price."],
                  ].map(([t, w]) => (
                    <div key={t} className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                      <Wand2 className="mt-0.5 size-4 shrink-0 text-[var(--brand-2)]" />
                      <span>
                        <span className="block text-sm font-semibold">{t}</span>
                        <span className="block text-xs text-muted-foreground">{w}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["shoot-travertine", "shoot-water", "shoot-moody"].map((s, i) => (
                  <div key={s} className={cn("overflow-hidden rounded-2xl border shadow-lg", i === 1 && "translate-y-8")}>
                    <Image src={`/showcase/${s}.webp`} alt="AI photoshoot" width={1080} height={1350} sizes="(min-width: 1024px) 20vw, 33vw" className="h-auto w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Every size */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <Heading
            eyebrow="Every placement"
            title="One ad. Four sizes. Zero extra credits."
            body="Square, feed, Stories & Reels, banners. Switch in one click — your copy and product stay right where they read best."
          />
          <div className="mt-12 grid grid-cols-2 items-end gap-4 md:grid-cols-[1fr_0.8fr_0.56fr_1.78fr]">
            {[
              { src: "/showcase/serum-square.webp", w: 1080, h: 1080, label: "Square 1:1" },
              { src: "/showcase/serum-portrait.webp", w: 1080, h: 1350, label: "Portrait 4:5" },
              { src: "/showcase/serum-story.webp", w: 1080, h: 1920, label: "Story 9:16" },
              { src: "/showcase/serum-landscape.webp", w: 1920, h: 1080, label: "Landscape 16:9" },
            ].map((f) => (
              <figure key={f.label} className={cn("flex flex-col gap-2", f.w > f.h && "col-span-2 md:col-span-1")}>
                <Image src={f.src} alt={f.label} width={f.w} height={f.h} sizes="(min-width: 768px) 25vw, 50vw" className="h-auto w-full rounded-2xl border shadow-sm" />
                <figcaption className="text-sm font-medium">{f.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Co-design + brand */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-20 md:py-28 lg:grid-cols-2">
            <Feature
              icon={Palette}
              title="You're the boss of every pixel"
              body="We design it — you make it yours. Change words, specs and features, add whole sections, swap colours, fonts, layouts and text size. Undo anything."
              points={["Edit & add specs, features, prices", "28 templates, 4 sizes, 3 text sizes", "Smart suggestions as you go", "Undo / redo, always"]}
              extraIcon={Undo2}
            />
            <Feature
              icon={Stamp}
              title="Your brand, on everything"
              body="Save your logo, colours, fonts and voice once. Every ad wears them — or switch to colours drawn from the product itself, ad by ad."
              points={["Logo placed where it reads best", "Brand or product colours, per ad", "Copy written in your voice", "Exact brand colours, every template"]}
              extraIcon={Smile}
            />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <Heading
            eyebrow="Pricing"
            title={<>Pay for results, <span className="text-brand">not seats.</span></>}
            body={`Start with ${SIGNUP_CREDITS} free credits. An ad is ${GENERATION_COST_CREDITS} credits, a photo ${PHOTOSHOOT_COST_CREDITS}, a full campaign ${CAMPAIGN_STRATEGY_CREDITS} + ${CAMPAIGN_AD_CREDITS} per ad. Edits, resizes, ideas and downloads are free.`}
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={cn(
                  "relative flex flex-col gap-5 rounded-3xl border bg-card p-6",
                  pack.popular && "ring-brand md:-translate-y-3",
                )}
              >
                {pack.popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-white">Most loved</span>
                )}
                <h3 className="font-semibold">{pack.name}</h3>
                <div>
                  <p className="text-5xl font-semibold tracking-tight">{formatPrice(pack.priceCents)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">one-time · {pack.blurb}</p>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {[
                    `${pack.credits.toLocaleString("en-US")} credits`,
                    `About ${generationsIn(pack).toLocaleString("en-US")} ads`,
                    "Campaigns, photoshoots, brand kit",
                    "Credits never expire",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={cn(
                    "mt-auto rounded-full px-4 py-2.5 text-center text-sm font-semibold transition",
                    pack.popular ? "bg-brand text-white hover:opacity-90" : "border hover:bg-muted",
                  )}
                >
                  Start free
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-20">
          <Heading eyebrow="FAQ" title="Questions, happily answered" />
          <div className="mt-8 divide-y rounded-3xl border bg-card">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.q}
                  <span className="text-xl leading-none text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-24">
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-5 overflow-hidden rounded-[2rem] bg-brand px-6 py-16 text-center text-white">
            <div aria-hidden className="absolute -left-20 -top-20 size-72 rounded-full bg-white/15 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -right-16 size-80 rounded-full bg-white/10 blur-3xl" />
            <Sparkles className="relative size-8" />
            <h2 className="relative max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Your best ad is one photo away.</h2>
            <p className="relative max-w-xl text-white/85">Bring a product. Leave with a campaign you&apos;re proud of. The first ones are on us.</p>
            <Link href="/signup" className="relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:scale-[1.03]">
              Get {SIGNUP_CREDITS} free credits <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> © {new Date().getFullYear()} AI Advertising Studio · made with joy
          </p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Glow({ className, color, delay }: { className?: string; color: string; delay?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full opacity-35 blur-3xl animate-float dark:opacity-30", className)}
      style={{ background: color, animationDelay: delay ? "-4s" : undefined }}
    />
  );
}

function FloatCard({
  className,
  src,
  w,
  h,
  alt,
  priority,
  delay,
}: {
  className?: string;
  src: string;
  w: number;
  h: number;
  alt: string;
  priority?: boolean;
  delay?: boolean;
}) {
  return (
    <div className={cn("absolute z-10", className)}>
      <div className="animate-float" style={{ animationDelay: delay ? "-3s" : undefined }}>
        <Image src={src} alt={alt} width={w} height={h} priority={priority} sizes="300px" className="h-auto w-full rounded-2xl border shadow-2xl" />
      </div>
    </div>
  );
}

function Heading({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body?: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-2)]">{eyebrow}</p>
      <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h2>
      {body && <p className="text-muted-foreground">{body}</p>}
    </div>
  );
}

function Pill({ icon: Icon, children }: { icon: typeof Camera; children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-semibold">
      <Icon className="size-3.5 text-[var(--brand-2)]" /> {children}
    </span>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
  points,
  extraIcon: Extra,
}: {
  icon: typeof Camera;
  title: string;
  body: string;
  points: string[];
  extraIcon: typeof Camera;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card p-8">
      <Extra aria-hidden className="absolute -bottom-6 -right-6 size-40 text-[var(--brand-1)] opacity-[0.07]" />
      <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-white">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 text-2xl font-semibold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
