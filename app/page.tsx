import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Camera, Check, Download, LayoutTemplate, PenLine, Ratio, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { CREDIT_PACKS, formatPrice, generationsIn } from "@/lib/credits/packs";
import { GENERATION_COST_CREDITS } from "@/lib/credits/pricing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIGNUP_CREDITS = 20;

const STEPS = [
  {
    icon: Camera,
    title: "Upload a product photo",
    body: "A phone shot on a plain backdrop is enough. Add a price or a few facts if you have them.",
  },
  {
    icon: Wand2,
    title: "AI art-directs the ad",
    body: "It reads the product, writes the copy, picks a layout and palette, cuts out the background and builds a scene.",
  },
  {
    icon: Download,
    title: "Tweak, resize, export",
    body: "Edit any word, swap between 25 templates, switch sizes, then download a print-ready PNG or a vector SVG.",
  },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Your real product, untouched", body: "AI only generates the backdrop. The product in the ad is your actual photo, never a hallucinated look-alike." },
  { icon: LayoutTemplate, title: "25 designer templates", body: "Editorial, brutalist, luxury, retro, tech. Switch with one click and the copy reflows to fit." },
  { icon: Ratio, title: "Every placement", body: "Square, 4:5 feed, 9:16 stories and reels, 16:9 banners. Same ad, reframed instantly, no extra credits." },
  { icon: PenLine, title: "Fully editable", body: "Headline, price, specs, colours, fonts. Every change re-lays out the design, so nothing ever overflows." },
  { icon: Download, title: "Print-sharp exports", body: "PNG up to 4320 px, or vector SVG you can open in Figma or Illustrator." },
  { icon: Sparkles, title: "Pay per ad, not per month", body: "Credits never expire, and a failed generation is refunded automatically." },
];

const FAQ = [
  { q: "Do I need design skills?", a: "No. The AI picks the layout, palette, typography and copy. You can change all of it, but you don't have to." },
  { q: "Will the AI change how my product looks?", a: "No. Your uploaded photo is placed into the design as-is, with only the backdrop removed. AI images are used for the background scene only." },
  { q: "What does a credit buy?", a: `Each ad generation costs ${GENERATION_COST_CREDITS} credits. Editing, switching templates, resizing and exporting are free and unlimited.` },
  { q: "Is there a subscription?", a: "No. Buy a credit pack when you need one. New accounts start with free credits to try it." },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <Sparkles className="size-4" />
            </span>
            AI Advertising Studio
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:inline">How it works</a>
            <a href="#pricing" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:inline">Pricing</a>
            <Button variant="ghost" size="sm" render={<Link href="/login" />} nativeButton={false}>Log in</Button>
            <Button size="sm" render={<Link href="/signup" />} nativeButton={false}>Get started</Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr]">
            <div className="flex flex-col items-start gap-6">
              <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                {SIGNUP_CREDITS} free credits when you sign up
              </span>
              <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Product photo in.
                <br />
                <span className="text-muted-foreground">Scroll-stopping ad out.</span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Upload one photo. AI writes the copy, art-directs the design and builds the ad in under a minute,
                ready for every feed, story and banner.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" render={<Link href="/signup" />} nativeButton={false} className="gap-2">
                  Make your first ad free <ArrowRight className="size-4" />
                </Button>
                <Button size="lg" variant="outline" render={<a href="#examples" />} nativeButton={false}>
                  See examples
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">No card needed. No subscription.</p>
            </div>

            <div className="relative mx-auto grid w-full max-w-[560px] grid-cols-[1fr_0.62fr] gap-3 sm:gap-4">
              <div className="flex flex-col gap-3 sm:gap-4">
                <Ad src="/showcase/candle.webp" alt="Candle ad, podium template" w={1080} h={1080} priority />
                <Ad src="/showcase/bottle.webp" alt="Water bottle ad, neo-brutal template" w={1080} h={1080} />
              </div>
              <div className="flex flex-col gap-3 pt-10 sm:gap-4">
                <Ad src="/showcase/buds-story.webp" alt="Earbuds story ad" w={1080} h={1920} priority />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <SectionHeading eyebrow="How it works" title="From photo to campaign in three steps" />
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-3 rounded-xl border bg-background p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                      <step.icon className="size-4" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Examples */}
        <section id="examples" className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <SectionHeading
            eyebrow="Made with the studio"
            title="Different products, genuinely different designs"
            body="Every one of these came out of the same engine. Rendered from a product photo, untouched by hand."
          />
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <Ad src="/showcase/coffee.webp" alt="Coffee ad, sale template" w={1080} h={1080} />
            <Ad src="/showcase/buds.webp" alt="Earbuds ad, tech HUD template" w={1080} h={1080} />
            <Ad src="/showcase/candle.webp" alt="Candle ad, podium template" w={1080} h={1080} />
            <Ad src="/showcase/bottle.webp" alt="Bottle ad, neo-brutal template" w={1080} h={1080} />
          </div>
        </section>

        {/* Formats */}
        <section className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <SectionHeading
              eyebrow="Every placement"
              title="One ad. Four sizes. Zero extra credits."
              body="Switch between square, feed, story and banner in the editor. The design reframes itself; your copy and product stay exactly where they read best."
            />
            <div className="mt-10 grid grid-cols-2 items-end gap-4 md:grid-cols-[1fr_0.8fr_0.56fr_1.78fr]">
              {[
                { src: "/showcase/serum-square.webp", w: 1080, h: 1080, label: "Square 1:1", use: "Feed" },
                { src: "/showcase/serum-portrait.webp", w: 1080, h: 1350, label: "Portrait 4:5", use: "Feed" },
                { src: "/showcase/serum-story.webp", w: 1080, h: 1920, label: "Story 9:16", use: "Stories, Reels, TikTok" },
                { src: "/showcase/serum-landscape.webp", w: 1920, h: 1080, label: "Landscape 16:9", use: "Banners, YouTube" },
              ].map((f) => (
                <figure key={f.label} className={cn("flex flex-col gap-2", f.w > f.h && "col-span-2 md:col-span-1")}>
                  <Ad src={f.src} alt={`Serum ad, ${f.label}`} w={f.w} h={f.h} />
                  <figcaption className="text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground"> · {f.use}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <SectionHeading eyebrow="Why it works" title="Built for people who sell things, not designers" />
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2">
                <f.icon className="size-5" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <SectionHeading
              eyebrow="Pricing"
              title="Pay for ads, not seats"
              body={`Start with ${SIGNUP_CREDITS} free credits. Each ad costs ${GENERATION_COST_CREDITS} credits; edits, resizes and exports are free.`}
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className={cn(
                    "flex flex-col gap-5 rounded-xl border bg-background p-6",
                    pack.popular && "ring-2 ring-foreground",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{pack.name}</h3>
                    {pack.popular && (
                      <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">Most popular</span>
                    )}
                  </div>
                  <div>
                    <p className="text-4xl font-semibold tracking-tight">{formatPrice(pack.priceCents)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">one-time</p>
                  </div>
                  <ul className="flex flex-col gap-2 text-sm">
                    <li className="flex gap-2"><Check className="size-4 shrink-0" />{pack.credits.toLocaleString("en-US")} credits</li>
                    <li className="flex gap-2"><Check className="size-4 shrink-0" />About {generationsIn(pack).toLocaleString("en-US")} ads</li>
                    <li className="flex gap-2"><Check className="size-4 shrink-0" />All templates and sizes</li>
                    <li className="flex gap-2"><Check className="size-4 shrink-0" />Credits never expire</li>
                  </ul>
                  <Button
                    className="mt-auto w-full"
                    variant={pack.popular ? "default" : "outline"}
                    render={<Link href="/signup" />}
                    nativeButton={false}
                  >
                    Start free
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 md:py-20">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-8 divide-y rounded-xl border">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.q}
                  <span className="text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-20">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-2xl bg-foreground px-6 py-14 text-center text-background">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Your next ad is one photo away.</h2>
            <p className="max-w-xl text-background/70">Sign up, upload a product, and see what the studio makes of it. The first ads are on us.</p>
            <Button size="lg" variant="secondary" render={<Link href="/signup" />} nativeButton={false} className="gap-2">
              Get {SIGNUP_CREDITS} free credits <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} AI Advertising Studio</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="text-muted-foreground">{body}</p>}
    </div>
  );
}

function Ad({ src, alt, w, h, priority }: { src: string; alt: string; w: number; h: number; priority?: boolean }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      priority={priority}
      sizes="(min-width: 1024px) 400px, 50vw"
      className="h-auto w-full rounded-xl border shadow-sm"
    />
  );
}
