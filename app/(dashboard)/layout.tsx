import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { getCreditBalance } from "@/lib/credits/getBalance";
import { CreditBalanceWidget } from "@/components/dashboard/CreditBalanceWidget";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { balance, reserved } = await getCreditBalance(user.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              AI Advertising Studio
            </Link>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
              Products
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <CreditBalanceWidget balance={balance} reserved={reserved} />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
