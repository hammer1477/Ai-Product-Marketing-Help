import Link from "next/link";
import { ArrowRight, Camera, Crown, Megaphone, Sparkles } from "lucide-react";
import type { Role } from "@/lib/profile/getProfile";
import { cn } from "@/lib/utils";

// Royalty. The Master wears gold; the Master's family wears rose gold and
// pearl — one step down the line of succession, unmistakably special.

export type Tier = "master" | "family";

export function tierOf(role: Role): Tier | null {
  return role === "owner" ? "master" : role === "family" ? "family" : null;
}

const CROWN_STYLE: Record<Tier, string> = {
  master: "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.55)]",
  family: "text-[#e9a99b] drop-shadow-[0_0_6px_rgba(233,169,155,0.55)]",
};

/** The crown itself, in the wearer's metal. */
export function RoyalCrown({ tier, className }: { tier: Tier; className?: string }) {
  return <Crown className={cn("shrink-0", CROWN_STYLE[tier], className)} aria-label={tier === "master" ? "Master" : "Royal family"} />;
}

/** Header chip announcing the title. */
export function RoyalChip({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
        tier === "master"
          ? "border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-rose-600/15 text-amber-600 dark:text-amber-300"
          : "border-[#e9a99b]/60 bg-gradient-to-r from-[#f6d5cb]/40 to-[#fff4ec]/30 text-[#b9665a] dark:from-[#e9a99b]/15 dark:to-[#fde7dc]/10 dark:text-[#f3bfb2]",
      )}
    >
      <RoyalCrown tier={tier} className="size-3.5" />
      {tier === "master" ? "Master" : "Royal family"}
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

/** The welcome on the home page for royalty. */
export function RoyalWelcome({ tier, name }: { tier: Tier; name: string }) {
  const master = tier === "master";
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        master
          ? "border-amber-500/40 bg-gradient-to-br from-[#2a0a12] via-[#1a0709] to-[#0d0608] text-amber-50"
          : "border-[#e9a99b]/50 bg-gradient-to-br from-[#fff3ed] via-[#fbe3da] to-[#f3cfc4] text-[#5a2a24] dark:from-[#3a1d1d] dark:via-[#2a1517] dark:to-[#1d1012] dark:text-[#fde7dc]",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: crownPattern(master ? "#d4a43a" : "#c97b6d") }} />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full blur-3xl"
        style={{ background: master ? "rgba(212,164,58,0.35)" : "rgba(233,169,155,0.45)" }}
      />
      {/* Pearls along the top edge, for the family. */}
      {!master && (
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-3 flex justify-between">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="size-2 rounded-full bg-gradient-to-br from-white to-[#f1d9cf] shadow-sm dark:from-[#fff7f2] dark:to-[#d9b8ad]" />
          ))}
        </div>
      )}
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl shadow-lg",
              master ? "bg-gradient-to-br from-amber-300 via-amber-500 to-rose-700 text-black" : "bg-gradient-to-br from-[#fff6f1] via-[#f2b8a9] to-[#c97b6d] text-white",
            )}
          >
            <Crown className="size-7" />
          </span>
          <div>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.25em]", master ? "text-amber-400/80" : "text-[#c97b6d] dark:text-[#f3bfb2]")}>
              {master ? "The Master" : "Royal family"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {master ? `Your studio, Master ${name}.` : `Welcome home, ${name}.`}
            </h2>
            <p className={cn("mt-1 text-sm", master ? "text-rose-100/70" : "opacity-80")}>
              {master
                ? "Everything runs on your word. Your console has the whole empire in view."
                : "You're family of the Master — every ad, campaign and photoshoot is on the house. Unlimited, always."}
            </p>
          </div>
        </div>
        {master ? (
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
                className="inline-flex items-center gap-1.5 rounded-full border border-[#c97b6d]/40 bg-white/60 px-4 py-2 text-sm font-medium text-[#8a4a40] transition hover:bg-white dark:bg-white/5 dark:text-[#fde7dc] dark:hover:bg-white/10"
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
