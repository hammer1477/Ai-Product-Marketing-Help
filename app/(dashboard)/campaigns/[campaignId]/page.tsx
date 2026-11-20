import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { isWorking, loadProjectCards } from "@/lib/jobs/projectStatus";
import { AdCard } from "@/components/creative/AdCard";
import { AutoRefresh } from "@/components/jobs/AutoRefresh";

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, created_at, products(id, name)")
    .eq("id", campaignId)
    .single();
  if (!campaign) notFound();
  const product = campaign.products as unknown as { id: string; name: string } | null;

  const cards = await loadProjectCards(supabase, { campaignId });
  const working = cards.filter((c) => isWorking(c.status)).length;
  const done = cards.filter((c) => c.imageUrl).length;

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={working > 0} />
      <div>
        {product && (
          <Link href={`/products/${product.id}`} className="text-sm text-muted-foreground underline underline-offset-4">
            &larr; {product.name}
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-semibold">Campaign pack</h1>
        <p className="text-muted-foreground">
          {working > 0
            ? `Designing ${working} of ${cards.length} ads in parallel — this page updates by itself. About a minute each.`
            : `${done} ads, each selling a different angle. Run them side by side and keep the winner.`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <AdCard key={card.id} card={card} />
        ))}
      </div>
      {working === 0 && done > 0 && (
        <p className="text-sm text-muted-foreground">
          Open any ad to edit its copy, switch template or resize it for stories and banners.
        </p>
      )}
    </div>
  );
}
