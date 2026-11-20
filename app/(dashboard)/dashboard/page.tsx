import Link from "next/link";
import { createClient } from "@/lib/db/supabase/server";
import { getProfile, greetingName } from "@/lib/profile/getProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoyalWelcome, tierOf } from "@/components/royal/Royal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await getProfile(user.id) : null;
  const name = profile ? greetingName(profile, user?.email) : null;

  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const tier = profile ? tierOf(profile.role) : null;

  return (
    <div className="flex flex-col gap-8">
      {tier && name && <RoyalWelcome tier={tier} name={name} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back{name ? `, ${name}` : ""}.</p>
        </div>
        <Button render={<Link href="/products/new" />} nativeButton={false}>
          New product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent products</CardTitle>
          <CardDescription>Your most recently added products.</CardDescription>
        </CardHeader>
        <CardContent>
          {!products || products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products yet.{" "}
              <Link href="/products/new" className="underline underline-offset-4">
                Add your first product
              </Link>{" "}
              to start generating creatives.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted/50"
                  >
                    <span className="font-medium">{product.name || "Untitled product"}</span>
                    <span className="text-sm text-muted-foreground">{product.category || "Uncategorized"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
