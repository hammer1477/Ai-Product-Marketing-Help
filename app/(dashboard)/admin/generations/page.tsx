import Link from "next/link";
import { Camera, Image as ImageIcon, Megaphone } from "lucide-react";
import { adTiles, admin, directory, generatedUrl, requireOwner } from "@/lib/admin/data";
import type { CampaignPlan } from "@/lib/campaign/plan";
import { PageTitle, Panel, Tile, angleName, shortDate } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "ads", label: "Ads", icon: ImageIcon },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "photos", label: "Photoshoots", icon: Camera },
] as const;

const LIMIT = 90;

export default async function MasterGenerations({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireOwner();
  const { type: raw } = await searchParams;
  const type = TYPES.find((t) => t.id === raw)?.id ?? "ads";
  const a = admin();
  const people = await directory();

  let body: React.ReactNode = null;
  let productIds: string[] = [];

  if (type === "ads") {
    const ads = await adTiles({ limit: LIMIT });
    productIds = ads.map((x) => x.productId);
    const names = await productNames(productIds);
    body = (
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-5 [&>*]:mb-4">
        {ads.map((ad) => (
          <Tile
            key={ad.projectId}
            url={ad.url}
            width={ad.width}
            height={ad.height}
            title={names.get(ad.productId) ?? "Product"}
            href={`/admin/products/${ad.productId}`}
            meta={`${people.get(ad.userId)?.name ?? "someone"} · ${ad.campaignId ? angleName(ad.angle) : "single ad"} · ${shortDate(ad.createdAt)}`}
          />
        ))}
      </div>
    );
  } else if (type === "photos") {
    const { data: shots } = await a
      .from("photoshoot_images")
      .select("id, user_id, product_id, scene, storage_path, width, height, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    const names = await productNames((shots ?? []).map((s) => s.product_id));
    body = (
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-5 [&>*]:mb-4">
        {(shots ?? []).map((s) => (
          <Tile
            key={s.id}
            url={generatedUrl(s.storage_path)}
            width={s.width}
            height={s.height}
            title={names.get(s.product_id) ?? "Product"}
            href={`/admin/products/${s.product_id}`}
            meta={`${people.get(s.user_id)?.name ?? "someone"} · ${s.scene} · ${shortDate(s.created_at)}`}
          />
        ))}
      </div>
    );
  } else {
    const { data: campaigns } = await a
      .from("campaigns")
      .select("id, user_id, product_id, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const names = await productNames((campaigns ?? []).map((c) => c.product_id));
    const tiles = await adTiles({ limit: 400 });
    const byCampaign = new Map<string, typeof tiles>();
    for (const t of tiles) if (t.campaignId) byCampaign.set(t.campaignId, [...(byCampaign.get(t.campaignId) ?? []), t]);
    body = (
      <div className="flex flex-col gap-4">
        {(campaigns ?? []).map((c) => {
          const plan = c.plan as CampaignPlan | null;
          const own = byCampaign.get(c.id) ?? [];
          return (
            <article key={c.id} className="grid gap-4 rounded-xl border border-amber-500/10 bg-black/20 p-4 md:grid-cols-[1fr_1.4fr]">
              <div className="min-w-0">
                <p className="text-xs text-rose-100/50">
                  <Link href={`/admin/users/${c.user_id}`} className="hover:underline">{people.get(c.user_id)?.name ?? "someone"}</Link>
                  {" · "}
                  <Link href={`/admin/products/${c.product_id}`} className="hover:underline">{names.get(c.product_id) ?? "Product"}</Link>
                  {" · "}
                  {shortDate(c.created_at)}
                </p>
                <h3 className="mt-1 font-semibold text-amber-50">{plan?.strategy.bigIdea ?? "Not finished (failed or still running)"}</h3>
                {plan && <p className="mt-1 line-clamp-3 text-sm text-rose-100/60">{plan.strategy.summary}</p>}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {own.slice(0, 4).map((t) => (
                  <Tile key={t.projectId} url={t.url} width={t.width} height={t.height} title={angleName(t.angle)} />
                ))}
              </div>
            </article>
          );
        })}
        {(campaigns ?? []).length === 0 && <p className="text-sm text-rose-100/50">No campaigns yet.</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow="Generations" title="Everything the studio has made" sub="Every ad, campaign and photoshoot, newest first. Open the full image, download it, or jump to the product." />
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <Link
            key={t.id}
            href={`/admin/generations?type=${t.id}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition",
              type === t.id ? "border-amber-400/60 bg-amber-500/20 font-semibold text-amber-100" : "border-amber-500/15 text-rose-100/70 hover:text-amber-100",
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
          </Link>
        ))}
      </div>
      <Panel>{body}</Panel>
    </div>
  );
}

async function productNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await admin().from("products").select("id, name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.name || "Untitled product"]));
}
