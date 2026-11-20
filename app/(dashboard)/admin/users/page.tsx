import Link from "next/link";
import { Crown, FolderOpen, Users } from "lucide-react";
import { admin, directory, requireOwner } from "@/lib/admin/data";
import { hasUnlimitedCredits } from "@/lib/profile/getProfile";
import { formatCredits } from "@/lib/credits/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle, Panel, shortDate } from "@/components/admin/ui";
import { CreditsForm, RoleForm } from "../UserRowActions";

function tally(rows: { user_id: string }[] | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
  return m;
}

export default async function MasterSubjects({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireOwner();
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const a = admin();

  const [people, { data: balances }, { data: products }, { data: projects }, { data: shots }] = await Promise.all([
    directory(),
    a.from("credit_balances").select("user_id, balance, reserved"),
    a.from("products").select("user_id"),
    a.from("creative_projects").select("user_id"),
    a.from("photoshoot_images").select("user_id"),
  ]);
  const balanceById = new Map((balances ?? []).map((b) => [b.user_id, Number(b.balance) - Number(b.reserved)]));
  const productCount = tally(products);
  const adCount = tally(projects);
  const shotCount = tally(shots);

  const rows = [...people.values()]
    .filter(
      (p) =>
        !query ||
        p.email.toLowerCase().includes(query) ||
        p.username?.toLowerCase().includes(query) ||
        p.displayName?.toLowerCase().includes(query),
    )
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow="Subjects"
        title={`${people.size} in your service`}
        sub="Grant or revoke credits, raise someone to Family (unlimited) or Owner, or open their file to see everything they've made."
      />

      <Panel
        title="Everyone"
        icon={Users}
        action={
          <form className="flex gap-2" action="/admin/users">
            <Input name="q" defaultValue={q} placeholder="Find a subject…" className="w-56 border-amber-500/20 bg-black/40" />
            <Button type="submit" variant="outline" className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10">
              Summon
            </Button>
            {q && (
              <Button variant="ghost" render={<Link href="/admin/users" />} nativeButton={false}>
                Clear
              </Button>
            )}
          </form>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-rose-100/50">No one answers to that name.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-amber-200/50">
                  <th className="py-2 pr-4 font-medium">Subject</th>
                  <th className="py-2 pr-4 font-medium">Made</th>
                  <th className="py-2 pr-4 font-medium">Credits</th>
                  <th className="py-2 pr-4 font-medium">Grant / revoke credits</th>
                  <th className="py-2 pr-4 font-medium">Rank</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/users/${p.id}`} className="flex items-center gap-2 font-medium text-amber-50 hover:underline">
                        {p.role === "owner" && <Crown className="size-3.5 text-amber-400" />}
                        {p.name}
                        {p.id === me.id && <Badge className="bg-amber-500/20 text-amber-200">You, Master</Badge>}
                      </Link>
                      <div className="text-rose-100/50">{p.email}</div>
                      <div className="text-xs text-rose-100/40">Joined {shortDate(p.createdAt)}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-rose-100/70">
                      <div>{productCount.get(p.id) ?? 0} products</div>
                      <div>{adCount.get(p.id) ?? 0} ads</div>
                      <div>{shotCount.get(p.id) ?? 0} photos</div>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-amber-100">
                      {hasUnlimitedCredits(p.role) ? "∞" : formatCredits(balanceById.get(p.id) ?? 0)}
                    </td>
                    <td className="py-3 pr-4">
                      <CreditsForm userId={p.id} />
                    </td>
                    <td className="py-3 pr-4">
                      <RoleForm userId={p.id} role={p.role} isSelf={p.id === me.id} />
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        render={<Link href={`/admin/users/${p.id}`} />}
                        nativeButton={false}
                        className="gap-1.5 border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                      >
                        <FolderOpen className="size-3.5" /> Open file
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
