import { redirect } from "next/navigation";
import { Check, CircleAlert, Sparkles } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { getCreditBalance } from "@/lib/credits/getBalance";
import { formatCredits } from "@/lib/credits/format";
import { GENERATION_COST_CREDITS } from "@/lib/credits/pricing";
import { CREDIT_PACKS, formatPrice, generationsIn } from "@/lib/credits/packs";
import { getProfile, hasUnlimitedCredits } from "@/lib/profile/getProfile";
import { fulfillCheckoutSession, getStripe, paymentsEnabled } from "@/lib/payments/stripe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { startCheckout } from "./actions";

type Notice = { tone: "success" | "error" | "info"; text: string };

const ERRORS: Record<string, string> = {
  "payments-disabled": "Payments aren't switched on yet. Check back soon.",
  "unknown-pack": "That credit pack doesn't exist.",
  "checkout-failed": "Couldn't start checkout. Please try again.",
};

/**
 * Back from Stripe: grant the credits now rather than waiting on the
 * webhook, so the balance is right the moment the page loads. Idempotent
 * with the webhook, so whichever arrives second does nothing.
 */
async function noticeForReturn(sessionId: string, userId: string): Promise<Notice> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== userId) {
      return { tone: "error", text: "That checkout belongs to a different account." };
    }
    if (session.payment_status !== "paid") {
      return { tone: "info", text: "Payment is processing. Credits are added as soon as it clears." };
    }
    const { credits } = await fulfillCheckoutSession(session);
    return { tone: "success", text: `Payment received. ${credits.toLocaleString("en-US")} credits added to your account.` };
  } catch (err) {
    console.error("Checkout return failed:", err);
    return { tone: "error", text: "We couldn't confirm that payment yet. If you were charged, credits will appear shortly." };
  }
}

type Txn = {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  generation_jobs: { kind: string } | null;
};

function describe(txn: Txn): { label: string; delta: string; muted?: boolean } | null {
  const n = Number(txn.amount);
  switch (txn.type) {
    case "purchase":
      return { label: "Credit pack purchase", delta: `+${n.toLocaleString("en-US")}` };
    case "grant":
      return { label: "Free credits", delta: `+${n.toLocaleString("en-US")}` };
    case "adjust":
      return { label: "Adjustment", delta: `${n > 0 ? "+" : ""}${n.toLocaleString("en-US")}` };
    case "reserve": {
      const what = txn.generation_jobs?.kind === "photoshoot" ? "Photoshoot shot" : "Ad generation";
      if (txn.status === "refunded") return { label: `${what} failed — refunded`, delta: "0", muted: true };
      if (txn.status === "pending") return { label: `${what} in progress`, delta: `−${n.toLocaleString("en-US")}`, muted: true };
      return { label: what, delta: `−${n.toLocaleString("en-US")}` };
    }
    default:
      return null;
  }
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; cancelled?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/credits");

  let notice: Notice | null = null;
  if (params.session_id && paymentsEnabled()) notice = await noticeForReturn(params.session_id, user.id);
  else if (params.cancelled) notice = { tone: "info", text: "Checkout cancelled. You weren't charged." };
  else if (params.error) notice = { tone: "error", text: ERRORS[params.error] ?? "Something went wrong." };

  // Read after fulfilment so a just-bought pack is already in the balance.
  const [{ balance, reserved }, profile, { data: txns }] = await Promise.all([
    getCreditBalance(user.id),
    getProfile(user.id),
    supabase
      .from("credit_transactions")
      .select("id, type, amount, status, created_at, generation_jobs(kind)")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);
  const unlimited = hasUnlimitedCredits(profile.role);
  const spendable = Number(balance) - Number(reserved);
  const enabled = paymentsEnabled();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Credits</h1>
          <p className="text-muted-foreground">
            Each ad generation uses {GENERATION_COST_CREDITS} credits. Editing, resizing and exporting are free.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="text-3xl font-semibold tabular-nums">{unlimited ? "∞" : formatCredits(spendable)}</p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "success" && "border-emerald-500/40 bg-emerald-500/10",
            notice.tone === "error" && "border-destructive/40 bg-destructive/10",
          )}
        >
          {notice.tone === "success" ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      {unlimited ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-2 text-sm">
            <Sparkles className="size-4" />
            Your account has unlimited credits — nothing to buy.
          </CardContent>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          {!enabled && (
            <p className="text-sm text-muted-foreground">Purchasing is coming soon — packs are shown for reference.</p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <Card key={pack.id} className={cn(pack.popular && "ring-2 ring-foreground")}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{pack.name}</CardTitle>
                    {pack.popular && <Badge>Most popular</Badge>}
                  </div>
                  <CardDescription>{pack.blurb}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div>
                    <p className="text-3xl font-semibold">{formatPrice(pack.priceCents)}</p>
                    <p className="text-sm text-muted-foreground">
                      {pack.credits.toLocaleString("en-US")} credits · about {generationsIn(pack).toLocaleString("en-US")} ads
                    </p>
                  </div>
                  <form action={startCheckout}>
                    <input type="hidden" name="packId" value={pack.id} />
                    <Button type="submit" className="w-full" variant={pack.popular ? "default" : "outline"} disabled={!enabled}>
                      Buy {pack.name}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            One-time payments, no subscription. Credits never expire. Failed generations are refunded automatically.
          </p>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Your most recent credit movements.</CardDescription>
        </CardHeader>
        <CardContent>
          {!txns || txns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y">
              {(txns as unknown as Txn[]).map((txn) => {
                const row = describe(txn);
                if (!row) return null;
                return (
                  <li key={txn.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <div>
                      <p className={cn(row.muted && "text-muted-foreground")}>{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <span className={cn("font-medium tabular-nums", row.muted && "text-muted-foreground")}>{row.delta}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
