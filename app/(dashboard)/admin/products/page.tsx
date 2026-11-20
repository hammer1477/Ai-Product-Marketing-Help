import Link from "next/link";
import { Package } from "lucide-react";
import { admin, directory, productPhotos, requireOwner } from "@/lib/admin/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle, Panel, shortDate } from "@/components/admin/ui";

function tally(rows: { product_id: string }[] | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1);
  return m;
}

export default async function MasterProducts({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOwner();
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const a = admin();

  const [people, { data: products }, { data: projects }, { data: shots }] = await Promise.all([
    directory(),
    a.from("products").select("id, name, category, user_id, created_at").order("created_at", { ascending: false }),
    a.from("creative_projects").select("product_id"),
    a.from("photoshoot_images").select("product_id"),
  ]);
  const ads = tally(projects);
  const photosMade = tally(shots);

  const rows = (products ?? []).filter((p) => {
    if (!query) return true;
    const owner = people.get(p.user_id);
    return (
      (p.name ?? "").toLowerCase().includes(query) ||
      (p.category ?? "").toLowerCase().includes(query) ||
      owner?.email.toLowerCase().includes(query) ||
      owner?.name.toLowerCase().includes(query)
    );
  });
  const photos = await productPhotos(rows.slice(0, 120).map((p) => p.id));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow="Products" title={`${products?.length ?? 0} products across the realm`} sub="Every product anyone has added. Open one to see all its ads, campaigns and photoshoots." />
      <Panel
        title="All products"
        icon={Package}
        action={
          <form className="flex gap-2" action="/admin/products">
            <Input name="q" defaultValue={q} placeholder="Product, category or owner…" className="w-60 border-amber-500/20 bg-black/40" />
            <Button type="submit" variant="outline" className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10">
              Search
            </Button>
            {q && (
              <Button variant="ghost" render={<Link href="/admin/products" />} nativeButton={false}>
                Clear
              </Button>
            )}
          </form>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-rose-100/50">No products match.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {rows.slice(0, 120).map((p) => {
              const owner = people.get(p.user_id);
              return (
                <Link key={p.id} href={`/admin/products/${p.id}`} className="group flex flex-col gap-2 rounded-xl border border-amber-500/10 bg-black/20 p-2 transition hover:border-amber-400/40">
                  <div className="aspect-square overflow-hidden rounded-lg bg-black/40">
                    {photos.get(p.id) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photos.get(p.id)} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    )}
                  </div>
                  <div className="min-w-0 px-0.5 text-xs">
                    <p className="truncate text-sm font-medium text-amber-50">{p.name || "Untitled product"}</p>
                    <p className="truncate text-rose-100/60">{owner?.name ?? "Unknown"} · {p.category || "Uncategorized"}</p>
                    <p className="text-rose-100/40">
                      {ads.get(p.id) ?? 0} ads · {photosMade.get(p.id) ?? 0} photos · {shortDate(p.created_at)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {rows.length > 120 && <p className="text-xs text-rose-100/50">Showing the newest 120. Search to narrow it down.</p>}
      </Panel>
    </div>
  );
}
