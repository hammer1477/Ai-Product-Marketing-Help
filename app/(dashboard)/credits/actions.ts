"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { CREDIT_CURRENCY, packById } from "@/lib/credits/packs";
import { getStripe, paymentsEnabled } from "@/lib/payments/stripe";

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Starts a Stripe Checkout for a credit pack and sends the browser to it. */
export async function startCheckout(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/credits");

  const pack = packById(String(formData.get("packId") ?? ""));
  if (!pack) redirect("/credits?error=unknown-pack");
  if (!paymentsEnabled()) redirect("/credits?error=payments-disabled");

  const base = await siteUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    customer_email: user.email,
    metadata: { user_id: user.id, pack_id: pack.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CREDIT_CURRENCY,
          unit_amount: pack.priceCents,
          product_data: {
            name: `${pack.name} — ${pack.credits.toLocaleString("en-US")} credits`,
            description: pack.blurb,
          },
        },
      },
    ],
    success_url: `${base}/credits?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/credits?cancelled=1`,
  });

  if (!session.url) redirect("/credits?error=checkout-failed");
  redirect(session.url);
}
