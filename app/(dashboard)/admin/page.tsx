import Link from "next/link";
import {
  Activity,
  Camera,
  CheckCircle2,
  Coins,
  Crown,
  Gem,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Megaphone,
  Users,
  Vault,
  XCircle,
} from "lucide-react";
import { admin, directory, requireOwner } from "@/lib/admin/data";
import { greetingName, honorificFor, type Gender, type Honorific } from "@/lib/profile/getProfile";
import { formatCredits } from "@/lib/credits/format";
import { formatPrice } from "@/lib/credits/packs";
import { Panel, goldLink } from "@/components/admin/ui";
import { RoyalCrown } from "@/components/royal/Royal";
import { HangingPoster } from "@/components/admin/HangingPoster";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

/** Time windows and "now", computed once per request. */
function clock() {
  const now = Date.now();
  return { now, week: new Date(now - 7 * DAY).toISOString(), month: new Date(now - 30 * DAY).toISOString() };
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/**
 * How the console greets its owner — a surprise line each visit, picked from
 * the set that suits the owner's gender (set on their profile).
 */
const SHARED: Array<{ line: (h: Honorific) => string; sub: string }> = [
  { line: (h) => `Ready to serve, ${h.title}.`, sub: "Say the word and the studio gets to work." },
  { line: (h) => `Welcome back, ${h.title}.`, sub: "The studio awaits your command." },
  { line: (h) => `Your wish is my command, ${h.title}.`, sub: "Ads, campaigns, photoshoots — just point." },
  { line: (h) => `At your service, ${h.title}.`, sub: "What shall we conquer today?" },
];

const GREETINGS: Record<Gender, Array<{ line: (h: Honorific) => string; sub: string }>> = {
  male: [
    ...SHARED,
    { line: (h) => `How can I help you, ${h.pet}?`, sub: "Everything here bends to your will." },
    { line: (h) => `I've been waiting for you, ${h.pet}.`, sub: "Your empire missed you. Here's how it's doing." },
    { line: (h) => `The throne is warm, ${h.title}.`, sub: "Your kingdom has been busy while you were away." },
    { line: (h) => `All hail the king, ${h.title}.`, sub: "The numbers are in, and they look good on you." },
  ],
  female: [
    ...SHARED,
    { line: (h) => `How can I help you, ${h.pet}?`, sub: "Everything here bends to your will." },
    { line: (h) => `I've been waiting for you, ${h.pet}.`, sub: "Your empire missed you. Here's how it's doing." },
    { line: (h) => `Your Majesty returns, ${h.title}.`, sub: "The queendom kept itself polished for you." },
    { line: (h) => `All hail the queen, ${h.title}.`, sub: "The numbers are in, and they look good on you." },
  ],
};

function pickGreeting(gender: Gender | null, h: Honorific) {
  const set = GREETINGS[gender ?? "male"];
  const g = set[Math.floor(Math.random() * set.length)];
  return { line: g.line(h), sub: g.sub };
}

const KIND: Record<string, string> = { creative: "Ad", campaign: "Campaign", photoshoot: "Photo" };

export default async function MasterOverview() {
  const { now, week, month } = clock();
  const a = admin();
  const count = (table: string) => a.from(table).select("*", { count: "exact", head: true });

  // The owner check and the console's queries run side by side instead of one
  // after the other; nothing renders unless the check passes (it 404s otherwise).
  const [
    me,
    [
    people,
    { data: balances },
    { data: purchases },
    { data: spent },
    { count: adsMade },
    { count: campaignsMade },
    { count: shotsMade },
    { count: productCount },
    { data: weekJobs },
    { data: recentJobs },
    ],
  ] = await Promise.all([requireOwner(), Promise.all([
    directory(),
    a.from("credit_balances").select("user_id, balance, reserved"),
    a.from("credit_purchases").select("amount_cents, currency, created_at"),
    a.from("credit_transactions").select("amount").eq("type", "reserve").eq("status", "completed"),
    count("generated_images"),
    count("campaigns").not("plan", "is", null),
    count("photoshoot_images"),
    count("products"),
    a.from("generation_jobs").select("status").gte("created_at", week),
    a
      .from("generation_jobs")
      .select("id, kind, status, error_message, created_at, user_id, product_id")
      .order("created_at", { ascending: false })
      .limit(15),
  ])]);
  const honorific = honorificFor(me.profile.gender);
  const greeting = pickGreeting(me.profile.gender, honorific);

  const everyone = [...people.values()];
  const newThisWeek = everyone.filter((p) => p.createdAt >= week).length;
  const revenueAll = (purchases ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const revenueMonth = (purchases ?? []).filter((p) => p.created_at >= month).reduce((s, p) => s + p.amount_cents, 0);
  const currency = purchases?.[0]?.currency ?? "usd";
  const vault = (balances ?? []).reduce((s, b) => s + Number(b.balance) - Number(b.reserved), 0);
  const creditsSpent = (spent ?? []).reduce((s, t) => s + Number(t.amount), 0);
  const done = (weekJobs ?? []).filter((j) => j.status === "completed").length;
  const failed = (weekJobs ?? []).filter((j) => j.status === "failed").length;
  const obedience = done + failed > 0 ? Math.round((done / (done + failed)) * 100) : 100;

  const machinery = [
    { name: "Gemini (copy & strategy)", ok: Boolean(process.env.GEMINI_API_KEY) || process.env.AI_TEXT_PROVIDER === "mock" },
    { name: "Pollinations key (images)", ok: Boolean(process.env.POLLINATIONS_API_KEY) },
    { name: "Stripe payments", ok: Boolean(process.env.STRIPE_SECRET_KEY) },
    { name: "Stripe webhook", ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET) },
  ];

  const stats = [
    { icon: Users, label: "Subjects", value: everyone.length.toLocaleString("en-US"), note: `+${newThisWeek} this week`, href: "/admin/users" },
    { icon: Gem, label: "Tribute collected", value: formatPrice(revenueAll, currency), note: `${formatPrice(revenueMonth, currency)} last 30 days` },
    { icon: Vault, label: "Credits in the vault", value: formatCredits(vault), note: `${formatCredits(creditsSpent)} spent so far` },
    { icon: Activity, label: "Obedience rate", value: `${obedience}%`, note: `${done} done · ${failed} defied, 7 days` },
    { icon: ImageIcon, label: "Ads created", value: (adsMade ?? 0).toLocaleString("en-US"), note: `${productCount ?? 0} products`, href: "/admin/generations" },
    { icon: Megaphone, label: "Campaigns", value: (campaignsMade ?? 0).toLocaleString("en-US"), note: "strategy + playbook", href: "/admin/generations?type=campaigns" },
    { icon: Camera, label: "Photoshoots", value: (shotsMade ?? 0).toLocaleString("en-US"), note: "shots delivered", href: "/admin/generations?type=photos" },
    { icon: Coins, label: "Purchases", value: (purchases?.length ?? 0).toLocaleString("en-US"), note: "credit packs sold" },
  ];

  const family = everyone.filter((p) => p.role === "family");
  const friends = everyone.filter((p) => p.role === "friend");
  const newest = [...everyone].sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      {/* Top of the console: greeting and stats between the two hanging posters
          on wide screens; below that width the posters hang side by side under them. */}
      <div className="grid grid-cols-2 items-start gap-x-6 gap-y-8 xl:grid-cols-[14rem_minmax(0,1fr)_14rem] xl:gap-x-4">
      <div className="col-span-2 flex min-w-0 flex-col gap-8 xl:order-2 xl:col-span-1">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl sm:size-16 border border-amber-400/40 bg-gradient-to-br from-amber-300 via-amber-500 to-rose-700 text-black shadow-[0_0_40px_-6px_rgba(245,158,11,0.6)]">
            <Crown className="size-6 sm:size-8" />
          </span>
          <div>
            <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-rose-400 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-4xl">
              {greeting.line}
            </h1>
            <p className="mt-1 text-sm text-rose-100/60">
              {greeting.sub} <span className="text-amber-200/50">· {greetingName(me.profile, me.email)}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {machinery.map((m) => (
            <span
              key={m.name}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                m.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-rose-400/40 bg-rose-500/10 text-rose-300",
              )}
              title={m.ok ? "Configured" : "Not configured"}
            >
              {m.ok ? <KeyRound className="size-3" /> : <XCircle className="size-3" />}
              {m.name}
            </span>
          ))}
        </div>
      </header>

      {/* Between two posters on xl the middle column is narrow, so stats go 2-up there. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <s.icon className="absolute -right-3 -top-3 size-16 text-amber-400/10 transition group-hover:text-amber-400/20" />
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-amber-200/60">
                <s.icon className="size-3.5" /> {s.label}
              </p>
              <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-amber-50 sm:text-3xl">{s.value}</p>
              <p className="mt-0.5 text-xs text-rose-100/50">{s.note}</p>
            </>
          );
          const cls =
            "group relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-4 transition hover:border-amber-400/40";
          return s.href ? (
            <Link key={s.label} href={s.href} className={cls}>
              {body}
            </Link>
          ) : (
            <div key={s.label} className={cls}>
              {body}
            </div>
          );
        })}
      </section>
      {/* The centrepiece, filling the middle right under the stats. */}
      <HangingPoster
        src="/api/admin/poster/fourth"
        variant="feature"
        caption={`Ready to serve, ${honorific.pet}`}
        emoji={["😈", "❤️"]}
        className="mx-auto w-full max-w-4xl"
        // The whole photo, uncropped; it gets its height from the wider centre column.
        imgClassName="h-auto"
      />
      </div>
      {/* Left wall: the polaroid with a second one leaning the other way beneath it. */}
      <div className="flex w-full max-w-72 flex-col gap-10 justify-self-end xl:order-1 xl:justify-self-auto">
        {/* Same shape as "big" opposite it, so both walls match. */}
        <HangingPoster src="/api/admin/poster/small" variant="polaroid" className="w-full" imgClassName="aspect-[1920/3446]" />
        <HangingPoster
          src="/api/admin/poster/third"
          variant="polaroid"
          tilt="left"
          caption="all yours"
          className="w-full"
          // Same shape as "fifth" opposite it.
          imgClassName="aspect-[900/1344]"
        />
      </div>
      {/* Right wall: the big hanging poster with "Always yours" beneath it. */}
      <div className="flex w-full max-w-72 flex-col gap-10 justify-self-start xl:order-3 xl:justify-self-auto">
        <HangingPoster src="/api/admin/poster/big" className="w-full" imgClassName="h-auto" />
        <HangingPoster
          src="/api/admin/poster/fifth"
          variant="feature"
          caption="Always yours"
          emoji={["🖤", "🥀"]}
          glow="violet"
          className="w-full"
          imgClassName="h-auto"
        />
      </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Latest orders carried out"
          icon={Activity}
          className="min-w-0"
          action={
            <Link href="/admin/generations" className={cn(goldLink, "text-xs")}>
              See all generations →
            </Link>
          }
        >
          <ol className="-mr-2 flex max-h-96 flex-col divide-y divide-white/5 overflow-y-auto overscroll-contain pr-2">
            {(recentJobs ?? []).map((j) => {
              const who = people.get(j.user_id);
              return (
                <li key={j.id} className="flex items-start gap-3 py-2.5 text-sm">
                  {j.status === "completed" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  ) : j.status === "failed" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {j.product_id ? (
                        <Link href={`/admin/products/${j.product_id}`} className="font-medium text-amber-50 hover:underline">
                          {KIND[j.kind] ?? j.kind}
                        </Link>
                      ) : (
                        <span className="font-medium text-amber-50">{KIND[j.kind] ?? j.kind}</span>
                      )}
                      <span className="text-rose-100/50"> for </span>
                      <Link href={`/admin/users/${j.user_id}`} className="text-rose-100/70 hover:underline">
                        {who?.name ?? "someone"}
                      </Link>
                    </p>
                    {j.status === "failed" && j.error_message && (
                      <p className="truncate text-xs text-rose-300/70" title={j.error_message}>
                        {j.error_message}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-rose-100/40">{ago(j.created_at, now)}</span>
                </li>
              );
            })}
            {(recentJobs ?? []).length === 0 && <li className="py-4 text-sm text-rose-100/50">No orders yet. The realm is quiet.</li>}
          </ol>
        </Panel>

        <Panel
          title="Newest subjects"
          icon={Users}
          className="min-w-0"
          action={
            <Link href="/admin/users" className={cn(goldLink, "text-xs")}>
              Manage all →
            </Link>
          }
        >
          <ul className="flex flex-col divide-y divide-white/5">
            {newest.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/users/${p.id}`} className="block truncate font-medium text-amber-50 hover:underline">
                    {p.role === "owner" && <Crown className="mr-1 inline size-3.5 -translate-y-px text-amber-400" />}
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-rose-100/50">{p.email}</p>
                </div>
                <span className="shrink-0 text-xs text-rose-100/40">{ago(p.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title={
          <>
            <RoyalCrown tier="family" className="size-4" /> Royal family
          </>
        }
        action={<span className="text-xs text-rose-100/50">Unlimited, on the house. Raise anyone from Subjects.</span>}
      >
        {family.length === 0 ? (
          <p className="text-sm text-rose-100/50">No one has been raised to the family yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {family.map((p) => (
              <Link
                key={p.id}
                href={`/admin/users/${p.id}`}
                className="flex items-center gap-2.5 rounded-full border border-[#e9a99b]/40 bg-[#e9a99b]/10 py-1.5 pl-1.5 pr-4 text-sm transition hover:bg-[#e9a99b]/20"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#fff6f1] via-[#f2b8a9] to-[#c97b6d] text-xs font-semibold uppercase text-white">
                  {p.name.charAt(0)}
                </span>
                <span className="text-[#fde7dc]">{p.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={
          <>
            <RoyalCrown tier="friend" honorific={honorific} className="size-4" /> Friends of the {honorific.title}
          </>
        }
        action={<span className="text-xs text-rose-100/50">10,000 credits gifted once. Raise anyone from Subjects.</span>}
      >
        {friends.length === 0 ? (
          <p className="text-sm text-rose-100/50">No friends named yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {friends.map((p) => (
              <Link
                key={p.id}
                href={`/admin/users/${p.id}`}
                className="flex items-center gap-2.5 rounded-full border border-slate-400/30 bg-slate-300/10 py-1.5 pl-1.5 pr-4 text-sm transition hover:bg-slate-300/20"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-white via-slate-300 to-slate-500 text-xs font-semibold uppercase text-slate-800">
                  {p.name.charAt(0)}
                </span>
                <span className="text-slate-100">{p.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
