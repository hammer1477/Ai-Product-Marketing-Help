import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillCheckoutSession, getStripe } from "@/lib/payments/stripe";

// Stripe -> us. Grants credits when a Checkout Session is paid, including
// asynchronous methods that settle after the customer has left the page.
// In the Stripe dashboard, point a webhook at /api/stripe/webhook with the
// events checkout.session.completed and
// checkout.session.async_payment_succeeded.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // The raw body, unparsed — the signature is over the exact bytes.
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    try {
      await fulfillCheckoutSession(event.data.object);
    } catch (err) {
      console.error("Stripe fulfilment failed:", err);
      // 500 makes Stripe retry; fulfilment is idempotent, so retries are safe.
      return NextResponse.json({ error: "Fulfilment failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
