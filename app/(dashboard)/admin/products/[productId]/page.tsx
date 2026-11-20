import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Image as ImageIcon, Info, Megaphone } from "lucide-react";
import { adTiles, admin, directory, generatedUrl, productPhotos, requireOwner } from "@/lib/admin/data";
import type { CampaignPlan } from "@/lib/campaign/plan";
import { Badge } from "@/components/ui/badge";
import { PageTitle, Panel, Tile, angleName, goldLink, shortDate } from "@/components/admin/ui";

export default async function MasterProduct({ params }: { params: Promise<{ productId: string }> }) {
  await requireOwner();
  const { productId } = await params;
  const a = admin();

  const { data: product } = await a.from("products").select("*").eq("id", productId).maybeSingle();
  if (!product) notFound();

  const [people, photos, ads, { data: campaigns }, { data: shots }, { data: image }] = await Promise.all([
    directory(),
    productPhotos([productId]),
    adTiles({ productId, limit: 60 }),
    a.from("campaigns").select("id, plan, created_at, color_source").eq("product_id", productId).order("created_at", { ascending: false }),
    a
      .from("photoshoot_images")
      .select("id, scene, storage_path, width, height, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    a.from("product_images").select("ai_analysis").eq("product_id", productId).eq("is_primary", true).maybeSingle(),
  ]);
  const owner = people.get(product.user_id);
  const attrs = (product.attributes ?? {}) as Record<string, string>;
  const analysis = (image?.ai_analysis ?? null) as { productType?: string; visibleClaims?: string[]; materials?: string[] } | null;
  const tileOf = new Map(ads.map((t) => [t.projectId, t]));

  const details: Array<[string, string | null | undefined]> = [
    ["Category", product.category],
    ["Objective", product.objective],
    ["Platform", product.target_platform],
    ["Price", attrs.price],
    ["Brand", attrs.brandName],
    ["Offer", attrs.offer],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow={
          <Link href="/admin/products" className={goldLink}>
            ← Products
          </Link>
        }
        title={product.name || "Untitled product"}
        sub={
          <>
            Added {shortDate(product.created_at)} by{" "}
            {owner ? (
              <Link href={`/admin/users/${owner.id}`} className={goldLink}>
                {owner.name} ({owner.email})
              </Link>
            ) : (
              "unknown"
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="overflow-hidden rounded-2xl border border-amber-500/15 bg-black/40">
          {photos.get(productId) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos.get(productId)} alt="" className="w-full" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-rose-100/40">No photo</div>
          )}
        </div>
        <Panel title="Details" icon={Info}>
          {product.description && <p className="text-sm text-rose-50/90">{product.description}</p>}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-amber-200/50">{k}</dt>
                  <dd className="text-amber-50">{v}</dd>
                </div>
              ))}
          </dl>
          {attrs.specs && <p className="whitespace-pre-line text-sm text-rose-100/70">{attrs.specs}</p>}
          {analysis && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.productType && <Badge className="bg-amber-500/15 text-amber-200">{analysis.productType}</Badge>}
              {[...(analysis.visibleClaims ?? []), ...(analysis.materials ?? [])].slice(0, 10).map((x) => (
                <Badge key={x} variant="outline" className="border-amber-500/20 text-rose-100/80">
                  {x}
                </Badge>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={`Ads (${ads.length})`} icon={ImageIcon}>
        {ads.length === 0 ? (
          <p className="text-sm text-rose-100/50">No ads yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {ads.map((ad) => (
              <Tile
                key={ad.projectId}
                url={ad.url}
                width={ad.width}
                height={ad.height}
                title={ad.campaignId ? angleName(ad.angle) : "Single ad"}
                meta={shortDate(ad.createdAt)}
              />
            ))}
          </div>
        )}
      </Panel>

      {(campaigns?.length ?? 0) > 0 && (
        <Panel title={`Campaigns (${campaigns!.length})`} icon={Megaphone}>
          <div className="flex flex-col gap-5">
            {campaigns!.map((c) => {
              const plan = c.plan as CampaignPlan | null;
              return (
                <article key={c.id} className="rounded-xl border border-amber-500/10 bg-black/20 p-4">
                  <p className="text-xs text-rose-100/50">
                    {shortDate(c.created_at)} · {c.color_source === "product" ? "product colours" : "brand colours"}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-amber-50">{plan?.strategy.bigIdea ?? "Not finished (failed or still running)"}</h3>
                  {plan && (
                    <>
                      <p className="mt-1 text-sm text-rose-100/70">{plan.strategy.summary}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {plan.ads.map((ad) => {
                          const t = tileOf.get(ad.projectId);
                          return (
                            <Tile
                              key={ad.projectId}
                              url={t?.url ?? null}
                              width={t?.width ?? 1080}
                              height={t?.height ?? 1080}
                              title={angleName(ad.angle)}
                              meta={ad.social.adHeadline}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title={`Photoshoots (${shots?.length ?? 0})`} icon={Camera}>
        {!shots?.length ? (
          <p className="text-sm text-rose-100/50">No photoshoots yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {shots.map((s) => (
              <Tile key={s.id} url={generatedUrl(s.storage_path)} width={s.width} height={s.height} title={s.scene} meta={shortDate(s.created_at)} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
