import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { getMasterHonorific, getProfile, greetingName, honorificFor } from "@/lib/profile/getProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoyalWelcome, tierOf } from "@/components/royal/Royal";
import { CutoutIcon } from "@/components/background-remover/CutoutIcon";

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
  const honorific = profile?.role === "owner" ? honorificFor(profile.gender) : tier ? await getMasterHonorific() : undefined;

  return (
    <div className="flex flex-col gap-8">
      {tier && name && <RoyalWelcome tier={tier} name={name} honorific={honorific} />}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back{name ? `, ${name}` : ""}.</p>
        </div>
        <Button render={<Link href="/products/new" />} nativeButton={false}>
          New product
        </Button>
      </div>

      <Link
        href="/background-remover"
        className="group flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:ring-brand"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <CutoutIcon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Product Background Remover</span>
          <span className="block text-sm text-muted-foreground">
            Extract any product from its background and prepare it for professional advertising designs.
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Link>

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
                    className="flex items-center justify-between gap-4 rounded-md border px-4 py-3 hover:bg-muted/50"
                  >
                    <span className="min-w-0 truncate font-medium">{product.name || "Untitled product"}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{product.category || "Uncategorized"}</span>
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
