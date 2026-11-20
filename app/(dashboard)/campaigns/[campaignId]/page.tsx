import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Download, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { isWorking, loadProjectCards } from "@/lib/jobs/projectStatus";
import type { CampaignPlan } from "@/lib/campaign/plan";
import { AdCard } from "@/components/creative/AdCard";
import { AutoRefresh } from "@/components/jobs/AutoRefresh";
import { CampaignView } from "@/components/campaign/CampaignView";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Reading the product and pulling out every fact",
  "Writing the strategy: big idea, audiences, positioning",
  "Art-directing one look for the whole campaign",
  "Writing each ad and its social copy",
  "Designing the ads",
  "Planning your rollout, budget and A/B test",
];

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, created_at, plan, job_id, products(id, name)")
    .eq("id", campaignId)
    .single();
  if (!campaign) notFound();
  const product = campaign.products as unknown as { id: string; name: string } | null;

  const [cards, { data: job }] = await Promise.all([
    loadProjectCards(supabase, { campaignId }),
    campaign.job_id
      ? supabase.from("generation_jobs").select("status, error_message, created_at").eq("id", campaign.job_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const plan = campaign.plan as CampaignPlan | null;
  const legacy = !campaign.job_id;
  const running = job ? job.status === "pending" || job.status === "processing" : cards.some((c) => isWorking(c.status));
  const failed = job?.status === "failed";

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={running} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {product && (
            <Link href={`/products/${product.id}`} className="text-sm text-muted-foreground underline underline-offset-4">
              &larr; {product.name}
            </Link>
          )}
          <h1 className="mt-1 text-2xl font-semibold">Campaign{product ? ` · ${product.name}` : ""}</h1>
          <p className="text-muted-foreground">
            {plan
              ? `${plan.ads.length} ads, one strategy, and the plan to run them on Instagram and Facebook.`
              : running
                ? "Your campaign team is at work. This page updates by itself."
                : failed
                  ? "This campaign didn't come together."
                  : "Several ads, each selling a different angle."}
          </p>
        </div>
        {plan && (
          <Button render={<a href={`/api/campaigns/${campaign.id}/download`} />} nativeButton={false} className="gap-1.5">
            <Download className="size-4" /> Download everything (.zip)
          </Button>
        )}
      </div>

      {running && !legacy && <Progress startedAt={job?.created_at} />}

      {failed && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">The campaign couldn&apos;t be finished, so your credits were refunded.</p>
            <p className="text-muted-foreground">
              This is usually a busy AI service. Try again from the{" "}
              {product ? (
                <Link href={`/products/${product.id}`} className="underline underline-offset-4">product page</Link>
              ) : (
                "product page"
              )}{" "}
              in a minute.
            </p>
          </div>
        </div>
      )}

      {plan ? (
        <CampaignView plan={plan} cards={cards} />
      ) : legacy ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((card) => (
            <AdCard key={card.id} card={card} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Progress({ startedAt }: { startedAt?: string }) {
  // Steps light up on a rough clock — the job is one call, so this is a
  // guide to what's happening, not a live trace.
  const elapsed = startedAt ? (Date.parse(new Date().toISOString()) - Date.parse(startedAt)) / 1000 : 0;
  const current = Math.min(STEPS.length - 1, Math.floor(elapsed / 15));
  return (
    <div className="rounded-xl border p-5">
      <p className="text-sm font-medium">Building your campaign · usually 1–2 minutes</p>
      <ol className="mt-4 flex flex-col gap-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm">
            {i < current ? (
              <Check className="size-4 text-emerald-600" />
            ) : i === current ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <span className="size-4 rounded-full border" />
            )}
            <span className={i > current ? "text-muted-foreground" : undefined}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
