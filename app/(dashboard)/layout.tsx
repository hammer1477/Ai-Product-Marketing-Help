import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown } from "lucide-react";
import { createClient } from "@/lib/db/supabase/server";
import { getCreditBalance } from "@/lib/credits/getBalance";
import { CreditBalanceWidget } from "@/components/dashboard/CreditBalanceWidget";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { BrandMark } from "@/components/theme/BrandMark";
import { Backdrop } from "@/components/dashboard/Backdrop";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { getProfile, greetingName, hasUnlimitedCredits } from "@/lib/profile/getProfile";
import { RoyalChip, RoyalCrown, tierOf } from "@/components/royal/Royal";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/photoshoot", label: "Photoshoot" },
  { href: "/brand", label: "Brand" },
  { href: "/credits", label: "Credits" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ balance, reserved }, profile] = await Promise.all([getCreditBalance(user.id), getProfile(user.id)]);
  const owner = profile.role === "owner";
  const tier = tierOf(profile.role);

  return (
    <div className="relative isolate min-h-screen bg-background">
      <Backdrop />
      {/* A soft wash of the brand colours behind the header. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-60 dark:opacity-40"
        style={{
          background:
            tier === "family"
              ? "radial-gradient(60% 100% at 15% 0%, rgba(233,169,155,0.28), transparent), radial-gradient(50% 90% at 85% 0%, rgba(253,231,220,0.22), transparent)"
              : tier === "friend"
                ? "radial-gradient(60% 100% at 15% 0%, rgba(203,213,225,0.3), transparent), radial-gradient(50% 90% at 85% 0%, rgba(241,245,249,0.2), transparent)"
                : "radial-gradient(60% 100% at 15% 0%, color-mix(in oklab, var(--brand-1) 22%, transparent), transparent), radial-gradient(50% 90% at 85% 0%, color-mix(in oklab, var(--brand-2) 16%, transparent), transparent)",
        }}
      />
      <header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            <Link href="/dashboard" className="mr-3 flex shrink-0 items-center gap-2 font-semibold">
              <BrandMark />
              <span className="hidden sm:inline">AI Advertising Studio</span>
            </Link>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {(tier === "family" || tier === "friend") && (
              <Link href="/dashboard" className="ml-1">
                <RoyalChip tier={tier} />
              </Link>
            )}
            {owner && (
              <Link
                href="/admin"
                className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-rose-600/15 px-3 py-1.5 text-sm font-semibold text-amber-600 transition hover:from-amber-500/25 hover:to-rose-600/25 dark:text-amber-300"
              >
                <Crown className="size-3.5" /> Master console
              </Link>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-2.5">
            <Link href="/credits" aria-label="Credits">
              <CreditBalanceWidget balance={balance} reserved={reserved} unlimited={hasUnlimitedCredits(profile.role)} tier={tier} />
            </Link>
            <ThemeToggle />
            <Link href="/profile" className="hidden text-sm font-medium underline-offset-4 hover:underline md:inline">
              {tier && <RoyalCrown tier={tier} className="mr-1 inline size-3.5 -translate-y-px" />}
              {greetingName(profile, user.email)}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
