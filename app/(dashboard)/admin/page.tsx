import { notFound } from "next/navigation";
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
  Megaphone,
  Package,
  Users,
  Vault,
  XCircle,
} from "lucide-react";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";
import { getProfile, greetingName, hasUnlimitedCredits, isRole, type Role } from "@/lib/profile/getProfile";
import { formatCredits } from "@/lib/credits/format";
import { formatPrice } from "@/lib/credits/packs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreditsForm, RoleForm } from "./UserRowActions";

// The owner's console. Owner-only (404 for everyone else), and styled as a
// realm of its own: always dark, oxblood and gold — the one room in the
// studio that answers to the master.

type Row = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: Role;
  spendable: number;
  createdAt: string;
};

const DAY = 24 * 60 * 60 * 1000;

/** Time windows for the stats, computed once per request. */
function windows() {
  const now = Date.now();
  return { week: new Date(now - 7 * DAY).toISOString(), month: new Date(now - 30 * DAY).toISOString() };
}

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function requestTime(): number {
  return Date.now();
}

export default async function MasterConsole({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 404 rather than "forbidden" so non-owners don't learn the page exists.
  const me = user ? await getProfile(user.id) : null;
  if (!user || me?.role !== "owner") notFound();

  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const { week, month } = windows();
  const now = requestTime();

  const admin = createServiceRoleClient();
  const count = (table: string) => admin.from(table).select("*", { count: "exact", head: true });

  const [
    { data: authData, error: authError },
    { data: profiles },
    { data: balances },
    { data: purchases },
    { data: spent },
    { count: adsMade },
    { count: campaignsMade },
    { count: shotsMade },
    { count: productCount },
    { data: weekJobs },
    { data: recentJobs },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, username, display_name, role"),
    admin.from("credit_balances").select("user_id, balance, reserved"),
    admin.from("credit_purchases").select("amount_cents, currency, created_at"),
    admin.from("credit_transactions").select("amount").eq("type", "reserve").eq("status", "completed"),
    count("generated_images"),
    count("campaigns").not("plan", "is", null),
    count("photoshoot_images"),
    count("products"),
    admin.from("generation_jobs").select("status").gte("created_at", week),
    admin
      .from("generation_jobs")
      .select("id, kind, status, error_message, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  if (authError) throw new Error(`Failed to list users: ${authError.message}`);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const balanceById = new Map((balances ?? []).map((b) => [b.user_id, b]));
  const emailById = new Map(authData.users.map((u) => [u.id, u.email ?? "unknown"]));

  const rows: Row[] = authData.users
    .map((u) => {
      const p = profileById.get(u.id);
      const b = balanceById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        username: p?.username ?? null,
        displayName: p?.display_name ?? null,
        role: isRole(p?.role) ? p.role : "user",
        spendable: Number(b?.balance ?? 0) - Number(b?.reserved ?? 0),
        createdAt: u.created_at,
      } satisfies Row;
    })
    .filter(
      (r) =>
        !query ||
        r.email.toLowerCase().includes(query) ||
        r.username?.toLowerCase().includes(query) ||
        r.displayName?.toLowerCase().includes(query),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // The numbers of the realm.
  const newThisWeek = authData.users.filter((u) => u.created_at >= week).length;
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
    { icon: Users, label: "Subjects", value: authData.users.length.toLocaleString("en-US"), note: `+${newThisWeek} this week` },
    { icon: Gem, label: "Tribute collected", value: formatPrice(revenueAll, currency), note: `${formatPrice(revenueMonth, currency)} last 30 days` },
    { icon: Vault, label: "Credits in the vault", value: formatCredits(vault), note: `${formatCredits(creditsSpent)} spent so far` },
    { icon: Activity, label: "Obedience rate", value: `${obedience}%`, note: `${done} done · ${failed} defied, 7 days` },
    { icon: ImageIcon, label: "Ads created", value: (adsMade ?? 0).toLocaleString("en-US"), note: `${productCount ?? 0} products` },
    { icon: Megaphone, label: "Campaigns", value: (campaignsMade ?? 0).toLocaleString("en-US"), note: "strategy + playbook" },
    { icon: Camera, label: "Photoshoots", value: (shotsMade ?? 0).toLocaleString("en-US"), note: "shots delivered" },
    { icon: Coins, label: "Purchases", value: (purchases?.length ?? 0).toLocaleString("en-US"), note: "credit packs sold" },
  ];

  const kindLabel: Record<string, string> = { creative: "Ad", campaign: "Campaign", photoshoot: "Photo" };

  return (
    // `dark` forces the dark tokens in here whatever the site theme is.
    <div className="dark -mx-4 -my-8 min-h-[calc(100vh-57px)] overflow-hidden bg-[#0d0608] px-4 py-10 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 10% 0%, rgba(127,18,38,0.45), transparent 70%), radial-gradient(60% 50% at 100% 100%, rgba(180,120,20,0.18), transparent 70%)",
        }}
      />
      {/* Stitched-leather texture: faint diagonal lines. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 14px)" }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10">
        {/* Throne */}
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-300 via-amber-500 to-rose-700 text-black shadow-[0_0_40px_-6px_rgba(245,158,11,0.6)]">
              <Crown className="size-8" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400/80">Master console</p>
              <h1 className="mt-1 bg-gradient-to-r from-amber-200 via-amber-400 to-rose-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
                Welcome back, Master {greetingName(me, user.email)}.
              </h1>
              <p className="mt-1 text-sm text-rose-100/60">The studio awaits your command. Everything here bends to your will.</p>
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

        {/* The realm in numbers */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-amber-500/15 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-4 transition hover:border-amber-400/40"
            >
              <s.icon className="absolute -right-3 -top-3 size-16 text-amber-400/10 transition group-hover:text-amber-400/20" />
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-amber-200/60">
                <s.icon className="size-3.5" /> {s.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-50">{s.value}</p>
              <p className="mt-0.5 text-xs text-rose-100/50">{s.note}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          {/* Orders carried out */}
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/15 bg-black/30 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-amber-100">
              <Activity className="size-4 text-amber-400" /> Latest orders carried out
            </h2>
            <ol className="flex flex-col divide-y divide-white/5">
              {(recentJobs ?? []).map((j) => (
                <li key={j.id} className="flex items-start gap-3 py-2.5 text-sm">
                  {j.status === "completed" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  ) : j.status === "failed" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                  ) : (
                    <Package className="mt-0.5 size-4 shrink-0 animate-pulse text-amber-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium text-amber-50">{kindLabel[j.kind] ?? j.kind}</span>
                      <span className="text-rose-100/50"> for {emailById.get(j.user_id) ?? "someone"}</span>
                    </p>
                    {j.status === "failed" && j.error_message && (
                      <p className="truncate text-xs text-rose-300/70" title={j.error_message}>
                        {j.error_message}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-rose-100/40">{ago(j.created_at, now)}</span>
                </li>
              ))}
              {(recentJobs ?? []).length === 0 && <li className="py-4 text-sm text-rose-100/50">No orders yet. The realm is quiet.</li>}
            </ol>
          </section>

          {/* Subjects */}
          <section className="flex flex-col gap-4 rounded-2xl border border-amber-500/15 bg-black/30 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-amber-100">
                  <Users className="size-4 text-amber-400" /> Your subjects
                </h2>
                <p className="text-xs text-rose-100/50">
                  Grant or revoke credits, or raise someone to Family (unlimited) or Owner. Separate from purchases.
                </p>
              </div>
              <form className="flex gap-2" action="/admin">
                <Input name="q" defaultValue={q} placeholder="Find a subject…" className="w-52 border-amber-500/20 bg-black/40" />
                <Button type="submit" variant="outline" className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10">
                  Summon
                </Button>
                {q && (
                  <Button variant="ghost" render={<Link href="/admin" />} nativeButton={false}>
                    Clear
                  </Button>
                )}
              </form>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-rose-100/50">No one answers to that name.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-amber-200/50">
                      <th className="py-2 pr-4 font-medium">Subject</th>
                      <th className="py-2 pr-4 font-medium">Credits</th>
                      <th className="py-2 pr-4 font-medium">Grant / revoke</th>
                      <th className="py-2 pr-4 font-medium">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-white/5 align-top last:border-0">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2 font-medium text-amber-50">
                            {r.role === "owner" && <Crown className="size-3.5 text-amber-400" />}
                            {r.username || r.displayName || r.email.split("@")[0]}
                            {r.id === user.id && <Badge className="bg-amber-500/20 text-amber-200">You, Master</Badge>}
                          </div>
                          <div className="text-rose-100/50">{r.email}</div>
                          <div className="text-xs text-rose-100/40">
                            Joined {new Date(r.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-semibold text-amber-100" title={r.spendable.toLocaleString("en-US")}>
                          {hasUnlimitedCredits(r.role) ? "∞" : formatCredits(r.spendable)}
                        </td>
                        <td className="py-3 pr-4">
                          <CreditsForm userId={r.id} />
                        </td>
                        <td className="py-3 pr-4">
                          <RoleForm userId={r.id} role={r.role} isSelf={r.id === user.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <p className="text-center text-xs tracking-[0.25em] text-amber-200/30 uppercase">At your command, always.</p>
      </div>
    </div>
  );
}
