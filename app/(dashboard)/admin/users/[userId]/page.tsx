import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Coins, Crown, Image as ImageIcon, Megaphone, Package, ReceiptText } from "lucide-react";
import { adTiles, admin, directory, generatedUrl, productPhotos, requireOwner } from "@/lib/admin/data";
import { hasUnlimitedCredits } from "@/lib/profile/getProfile";
import { formatCredits } from "@/lib/credits/format";
import type { CampaignPlan } from "@/lib/campaign/plan";
import { PageTitle, Panel, Tile, angleName, goldLink, shortDate } from "@/components/admin/ui";
import { CreditsForm, RoleForm } from "../../UserRowActions";

const TX_LABEL: Record<string, string> = {
  purchase: "Bought a credit pack",
  grant: "Free credits",
  adjust: "Adjusted by you",
};

export default async function SubjectFile({ params }: { params: Promise<{ userId: string }> }) {
  const me = await requireOwner();
  const { userId } = await params;
  const a = admin();
  const people = await directory();
  const person = people.get(userId);
  if (!person) notFound();

  const [{ data: balance }, { data: txns }, { data: products }, ads, { data: campaigns }, { data: shots }] = await Promise.all([
    a.from("credit_balances").select("balance, reserved").eq("user_id", userId).maybeSingle(),
    a
      .from("credit_transactions")
      .select("id, type, amount, status, created_at, generation_jobs(kind)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    a.from("products").select("id, name, category, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    adTiles({ userId, limit: 24 }),
    a.from("campaigns").select("id, product_id, plan, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
    a
      .from("photoshoot_images")
      .select("id, product_id, scene, storage_path, width, height, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const photos = await productPhotos((products ?? []).map((p) => p.id));
  const productName = new Map((products ?? []).map((p) => [p.id, p.name || "Untitled product"]));
  const spendable = Number(balance?.balance ?? 0) - Number(balance?.reserved ?? 0);
  const unlimited = hasUnlimitedCredits(person.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          eyebrow={
            <Link href="/admin/users" className={goldLink}>
              ← Subjects
            </Link>
          }
          title={
            <>
              {person.role === "owner" && <Crown className="mr-2 inline size-7 -translate-y-1 text-amber-400" />}
              {person.name}
            </>
          }
          sub={`${person.email} · joined ${shortDate(person.createdAt)}${person.lastSignIn ? ` · last seen ${shortDate(person.lastSignIn)}` : ""}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Credits & rank" icon={Coins}>
          <p className="text-4xl font-semibold tracking-tight text-amber-50">{unlimited ? "∞" : formatCredits(spendable)}</p>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-amber-200/50">Grant / revoke credits</span>
            <CreditsForm userId={userId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wider text-amber-200/50">Rank</span>
            <RoleForm userId={userId} role={person.role} isSelf={userId === me.id} />
          </div>
        </Panel>

        <Panel title="Credit history" icon={ReceiptText}>
          {!txns?.length ? (
            <p className="text-sm text-rose-100/50">Nothing yet.</p>
          ) : (
            <ul className="flex max-h-72 flex-col divide-y divide-white/5 overflow-y-auto pr-1">
              {txns.map((t) => {
                const n = Number(t.amount);
                const kind = (t.generation_jobs as unknown as { kind: string } | null)?.kind;
                const label =
                  t.type === "reserve"
                    ? `${kind === "photoshoot" ? "Photoshoot" : kind === "campaign" ? "Campaign" : "Ad"}${t.status === "refunded" ? " — refunded" : t.status === "pending" ? " — in progress" : ""}`
                    : TX_LABEL[t.type] ?? t.type;
                const sign = t.type === "reserve" ? (t.status === "refunded" ? "" : "−") : n > 0 ? "+" : "";
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="text-amber-50">{label}</span>
                      <span className="ml-2 text-xs text-rose-100/40">{shortDate(t.created_at)}</span>
                    </span>
                    <span className="font-medium tabular-nums text-amber-100">
                      {sign}
                      {Math.abs(n).toLocaleString("en-US")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={`Products (${products?.length ?? 0})`} icon={Package}>
        {!products?.length ? (
          <p className="text-sm text-rose-100/50">No products yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {products.map((p) => (
              <Link key={p.id} href={`/admin/products/${p.id}`} className="group flex flex-col gap-1.5">
                <div className="aspect-square overflow-hidden rounded-xl border border-amber-500/15 bg-black/40">
                  {photos.get(p.id) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photos.get(p.id)} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  )}
                </div>
                <span className="truncate text-xs font-medium text-amber-50 group-hover:underline">{p.name || "Untitled product"}</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Ads (${ads.length}${ads.length === 24 ? "+" : ""})`} icon={ImageIcon}>
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
                title={productName.get(ad.productId) ?? "Product"}
                href={`/admin/products/${ad.productId}`}
                meta={`${ad.campaignId ? `Campaign · ${angleName(ad.angle)}` : "Single ad"} · ${shortDate(ad.createdAt)}`}
              />
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Campaigns (${campaigns?.length ?? 0})`} icon={Megaphone}>
          {!campaigns?.length ? (
            <p className="text-sm text-rose-100/50">No campaigns yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/5">
              {campaigns.map((c) => {
                const plan = c.plan as CampaignPlan | null;
                return (
                  <li key={c.id} className="py-2.5 text-sm">
                    <Link href={`/admin/products/${c.product_id}`} className="font-medium text-amber-50 hover:underline">
                      {plan?.strategy.bigIdea ?? "Campaign (not finished)"}
                    </Link>
                    <p className="text-xs text-rose-100/50">
                      {productName.get(c.product_id) ?? "Product"} · {plan ? `${plan.ads.length} ads` : "no plan"} · {shortDate(c.created_at)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={`Photoshoots (${shots?.length ?? 0}${shots?.length === 24 ? "+" : ""})`} icon={Camera}>
          {!shots?.length ? (
            <p className="text-sm text-rose-100/50">No photoshoots yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {shots.map((s) => (
                <Tile
                  key={s.id}
                  url={generatedUrl(s.storage_path)}
                  width={s.width}
                  height={s.height}
                  title={s.scene}
                  meta={productName.get(s.product_id)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
