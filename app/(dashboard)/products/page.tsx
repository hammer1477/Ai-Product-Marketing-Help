import Link from "next/link";
import { createClient } from "@/lib/db/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category, category_confirmed, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Button render={<Link href="/products/new" />}>New product</Button>
      </div>

      {!products || products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No products yet. Add your first one to start generating creatives.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex flex-col gap-1 py-5">
                  <span className="font-medium">{product.name || "Untitled product"}</span>
                  <span className="text-sm text-muted-foreground">{product.category || "Uncategorized"}</span>
                  {!product.category_confirmed && (
                    <span className="mt-2 w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Needs review
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
