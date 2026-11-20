import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { getProfile, greetingName, hasUnlimitedCredits } from "@/lib/profile/getProfile";
import { getCreditBalance } from "@/lib/credits/getBalance";
import { formatCredits } from "@/lib/credits/format";
import { Badge } from "@/components/ui/badge";
import { RoyalChip, tierOf } from "@/components/royal/Royal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, { balance, reserved }] = await Promise.all([
    getProfile(user.id),
    getCreditBalance(user.id),
  ]);
  const unlimited = hasUnlimitedCredits(profile.role);
  const spendable = Number(balance) - Number(reserved);
  const name = greetingName(profile, user.email);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-xl font-semibold uppercase">
          {name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {tierOf(profile.role) ? <RoyalChip tier={tierOf(profile.role)!} /> : profile.role !== "user" && <Badge className="capitalize">{profile.role}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
          <CardDescription>Each creative generation uses credits.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">
            {unlimited ? "Unlimited" : formatCredits(spendable)}
          </p>
          {!unlimited && reserved > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCredits(Number(reserved))} held for generations in progress
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear in the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm username={profile.username ?? ""} displayName={profile.displayName ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
