import Link from "next/link";
import { ArrowRight, Camera, Crown, Megaphone, Sparkles } from "lucide-react";
import type { Honorific, Role } from "@/lib/profile/getProfile";
import { cn } from "@/lib/utils";

// Royalty. The Master (or Mistress) wears gold; their family wears rose
// gold and pearl; their friends wear silver — down the line of succession,
// each unmistakably special.

export type Tier = "master" | "family" | "friend";

export function tierOf(role: Role): Tier | null {
  return role === "owner" ? "master" : role === "family" ? "family" : role === "friend" ? "friend" : null;
}

const CROWN_STYLE: Record<Tier, string> = {
  master: "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.55)]",
  family: "text-[#e9a99b] drop-shadow-[0_0_6px_rgba(233,169,155,0.55)]",
  friend: "text-slate-400 dark:text-slate-300 drop-shadow-[0_0_6px_rgba(203,213,225,0.55)]",
};

const MASTER: Honorific = { title: "Master", pet: "Daddy" };

/** Each tier's title, in terms of how the owner is addressed. */
export function royalTitle(tier: Tier, h: Honorific = MASTER): string {
  return tier === "master" ? h.title : tier === "family" ? "Royal family" : `Friend of the ${h.title}`;
}

/** The crown itself, in the wearer's metal. */
export function RoyalCrown({ tier, className, honorific }: { tier: Tier; className?: string; honorific?: Honorific }) {
  return <Crown className={cn("shrink-0", CROWN_STYLE[tier], className)} aria-label={royalTitle(tier, honorific)} />;
}

/** Header chip announcing the title. */
export function RoyalChip({ tier, honorific, className }: { tier: Tier; honorific?: Honorific; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
        tier === "master" && "border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-rose-600/15 text-amber-600 dark:text-amber-300",
        tier === "family" &&
          "border-[#e9a99b]/60 bg-gradient-to-r from-[#f6d5cb]/40 to-[#fff4ec]/30 text-[#b9665a] dark:from-[#e9a99b]/15 dark:to-[#fde7dc]/10 dark:text-[#f3bfb2]",
        tier === "friend" &&
          "border-slate-400/50 bg-gradient-to-r from-slate-200/50 to-white/30 text-slate-600 dark:from-slate-300/15 dark:to-white/5 dark:text-slate-200",
        className,
      )}
    >
      <RoyalCrown tier={tier} honorific={honorific} className="size-3.5" />
      {royalTitle(tier, honorific)}
    </span>
  );
}

/** A faint repeating crown pattern for royal surfaces. */
function crownPattern(color: string) {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>` +
      `<path d='M20 40 l2.5 -12 l5 6 l4.5 -9 l4.5 9 l5 -6 l2.5 12 Z' fill='${color}'/>` +
      `<circle cx='32' cy='22' r='1.6' fill='${color}'/>` +
      `</svg>`,
  )}")`;
}

/** Each tier's banner: its metal, its words. */
const WELCOME: Record<
  Tier,
  { section: string; pattern: string; glow: string; badge: string; eyebrow: string; title: (n: string, h: Honorific) => string; body: (h: Honorific) => string; sub: string; pearls?: string }
> = {
  master: {
    section: "border-amber-500/40 bg-gradient-to-br from-[#2a0a12] via-[#1a0709] to-[#0d0608] text-amber-50",
    pattern: "#d4a43a",
    glow: "rgba(212,164,58,0.35)",
    badge: "bg-gradient-to-br from-amber-300 via-amber-500 to-rose-700 text-black",
    eyebrow: "text-amber-400/80",
    title: (n, h) => `Your studio, ${h.title} ${n}.`,
    body: () => "Everything runs on your word. Your console has the whole empire in view.",
    sub: "text-rose-100/70",
  },
  family: {
    section:
      "border-[#e9a99b]/50 bg-gradient-to-br from-[#fff3ed] via-[#fbe3da] to-[#f3cfc4] text-[#5a2a24] dark:from-[#3a1d1d] dark:via-[#2a1517] dark:to-[#1d1012] dark:text-[#fde7dc]",
    pattern: "#c97b6d",
    glow: "rgba(233,169,155,0.45)",
    badge: "bg-gradient-to-br from-[#fff6f1] via-[#f2b8a9] to-[#c97b6d] text-white",
    eyebrow: "text-[#c97b6d] dark:text-[#f3bfb2]",
    title: (n) => `Welcome home, ${n}.`,
    body: (h) => `You're family of the ${h.title} — every ad, campaign and photoshoot is on the house. Unlimited, always.`,
    sub: "opacity-80",
    pearls: "from-white to-[#f1d9cf] dark:from-[#fff7f2] dark:to-[#d9b8ad]",
  },
  friend: {
    section:
      "border-slate-300/70 bg-gradient-to-br from-white via-slate-100 to-slate-200 text-slate-800 dark:border-slate-400/30 dark:from-[#1e2230] dark:via-[#171a25] dark:to-[#11131b] dark:text-slate-100",
    pattern: "#94a3b8",
    glow: "rgba(203,213,225,0.45)",
    badge: "bg-gradient-to-br from-white via-slate-300 to-slate-500 text-slate-800",
    eyebrow: "text-slate-500 dark:text-slate-300",
    title: (n) => `Welcome, ${n}.`,
    body: (h) => `A friend of the ${h.title} — your free credits are a gift, on the house. Make something great with them.`,
    sub: "opacity-80",
  },
};

/** The welcome on the home page for royalty. */
export function RoyalWelcome({ tier, name, honorific = MASTER }: { tier: Tier; name: string; honorific?: Honorific }) {
  const t = WELCOME[tier];
  return (
    <section className={cn("relative overflow-hidden rounded-3xl border p-5 sm:p-8", t.section)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: crownPattern(t.pattern) }} />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full blur-3xl" style={{ background: t.glow }} />
      {t.pearls && (
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-3 flex justify-between">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className={cn("size-2 rounded-full bg-gradient-to-br shadow-sm", t.pearls)} />
          ))}
        </div>
      )}
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-start gap-4 sm:items-center">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-lg sm:size-14", t.badge)}>
            <Crown className="size-6 sm:size-7" />
          </span>
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.25em]", t.eyebrow)}>{royalTitle(tier, honorific)}</p>
            <h2 className="mt-1 break-words text-xl font-semibold tracking-tight sm:text-3xl">{t.title(name, honorific)}</h2>
            <p className={cn("mt-1 text-sm", t.sub)}>{t.body(honorific)}</p>
          </div>
        </div>
        {tier === "master" ? (
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25"
          >
            Enter the console <ArrowRight className="size-4" />
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[
              { href: "/products/new", label: "New ad", icon: Sparkles },
              { href: "/products", label: "Campaign", icon: Megaphone },
              { href: "/photoshoot", label: "Photoshoot", icon: Camera },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border bg-white/60 px-4 py-2 text-sm font-medium transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10",
                  tier === "family" ? "border-[#c97b6d]/40 text-[#8a4a40] dark:text-[#fde7dc]" : "border-slate-400/40 text-slate-700 dark:text-slate-100",
                )}
              >
                <a.icon className="size-4" /> {a.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
