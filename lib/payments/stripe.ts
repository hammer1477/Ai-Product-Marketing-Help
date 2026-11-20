import "server-only";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/db/supabase/server";
import { packById } from "@/lib/credits/packs";

let client: Stripe | null = null;

/** Whether Stripe keys are configured. The credits page explains it when not. */
export function paymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

/**
 * Grants a paid Checkout Session's credits. Safe to call any number of
 * times for the same session — the database grants once (see migration
 * 0012) — which is what lets both the webhook and the success redirect
 * call it.
 *
 * Everything is read from the session Stripe returns, never from the
 * caller: the pack, the user and the amount paid.
 */
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<{ granted: boolean; credits: number }> {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return { granted: false, credits: 0 };
  }

  const userId = session.client_reference_id ?? session.metadata?.user_id;
  const pack = packById(session.metadata?.pack_id ?? "");
  if (!userId || !pack) {
    throw new Error(`Checkout session ${session.id} is missing its user or pack`);
  }

  const { data, error } = await createServiceRoleClient().rpc("fulfill_credit_purchase", {
    p_session_id: session.id,
    p_user_id: userId,
    p_pack_id: pack.id,
    p_credits: pack.credits,
    p_amount_cents: session.amount_total ?? 0,
    p_currency: session.currency ?? "usd",
  });
  if (error) throw new Error(`Failed to fulfil checkout session ${session.id}: ${error.message}`);

  return { granted: data === true, credits: pack.credits };
}
