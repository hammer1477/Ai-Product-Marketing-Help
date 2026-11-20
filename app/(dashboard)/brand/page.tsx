import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { BRAND_KIT_COLUMNS, readBrandKit } from "@/lib/brand/kit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandKitForm } from "./BrandKitForm";

export default async function BrandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/brand");

  const { data } = await supabase.from("brand_kits").select(BRAND_KIT_COLUMNS).eq("user_id", user.id).maybeSingle();
  const kit = readBrandKit(data);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Brand kit</h1>
        <p className="text-muted-foreground">
          Set it once. Every new ad uses your logo, colours, fonts and voice. Existing ads can pick it up from the editor.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your brand</CardTitle>
          <CardDescription>Everything here is optional. Fill in what you have.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandKitForm kit={kit} />
        </CardContent>
      </Card>
    </div>
  );
}
