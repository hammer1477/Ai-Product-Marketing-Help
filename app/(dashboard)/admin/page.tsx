import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceRoleClient } from "@/lib/db/supabase/server";
import { getProfile, hasUnlimitedCredits, isRole, type Role } from "@/lib/profile/getProfile";
import { formatCredits } from "@/lib/credits/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditsForm, RoleForm } from "./UserRowActions";

type Row = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: Role;
  spendable: number;
  createdAt: string;
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 404 rather than "forbidden" so non-owners don't learn the page exists.
  if (!user || (await getProfile(user.id)).role !== "owner") notFound();

  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();

  const admin = createServiceRoleClient();
  const [{ data: authData, error: authError }, { data: profiles }, { data: balances }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, username, display_name, role"),
    admin.from("credit_balances").select("user_id, balance, reserved"),
  ]);
  if (authError) throw new Error(`Failed to list users: ${authError.message}`);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const balanceById = new Map((balances ?? []).map((b) => [b.user_id, b]));

  const rows: Row[] = authData.users
    .map((u) => {
      const p = profileById.get(u.id);
      const b = balanceById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        username: p?.username ?? null,
        displayName: p?.display_name ?? null,
        role: isRole(p?.role) ? p.role : "user",
        spendable: Number(b?.balance ?? 0) - Number(b?.reserved ?? 0),
        createdAt: u.created_at,
      } satisfies Row;
    })
    .filter(
      (r) =>
        !query ||
        r.email.toLowerCase().includes(query) ||
        r.username?.toLowerCase().includes(query) ||
        r.displayName?.toLowerCase().includes(query),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const counts = { total: authData.users.length, family: 0, owner: 0 };
  for (const p of profiles ?? []) {
    if (p.role === "family") counts.family++;
    if (p.role === "owner") counts.owner++;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">
          {counts.total} accounts · {counts.owner} owner · {counts.family} family
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Add or remove credits, or give someone Family (free unlimited generations) or Owner (unlimited + this
            admin page) access. This is separate from clients buying credits.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex gap-2" action="/admin">
            <Input name="q" defaultValue={q} placeholder="Search email, username or name" className="max-w-sm" />
            <Button type="submit" variant="outline">
              Search
            </Button>
            {q && (
              <Button variant="ghost" render={<Link href="/admin" />} nativeButton={false}>
                Clear
              </Button>
            )}
          </form>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Account</th>
                    <th className="py-2 pr-4 font-medium">Credits</th>
                    <th className="py-2 pr-4 font-medium">Adjust credits</th>
                    <th className="py-2 pr-4 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b align-top last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 font-medium">
                          {r.username || r.displayName || r.email.split("@")[0]}
                          {r.id === user.id && <Badge variant="outline">You</Badge>}
                        </div>
                        <div className="text-muted-foreground">{r.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(r.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-semibold" title={r.spendable.toLocaleString("en-US")}>
                        {hasUnlimitedCredits(r.role) ? "∞" : formatCredits(r.spendable)}
                      </td>
                      <td className="py-3 pr-4">
                        <CreditsForm userId={r.id} />
                      </td>
                      <td className="py-3 pr-4">
                        <RoleForm userId={r.id} role={r.role} isSelf={r.id === user.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
