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
import { PoweredByCovenX } from "@/components/theme/PoweredByCovenX";
import { Toaster } from "@/components/ui/sonner";
import { getMasterHonorific, getProfile, greetingName, hasUnlimitedCredits, honorificFor } from "@/lib/profile/getProfile";
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

  const name = greetingName(profile, user.email);
  // The owner's own honorific; family and friends see the owner's.
  const honorific = owner ? honorificFor(profile.gender) : tier ? await getMasterHonorific() : undefined;

  const navLinks = (
    <>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {item.label}
        </Link>
      ))}
      {(tier === "family" || tier === "friend") && (
        <Link href="/dashboard" className="ml-1 shrink-0">
          <RoyalChip tier={tier} honorific={honorific} />
        </Link>
      )}
      {owner && (
        <Link
          href="/admin"
          className="ml-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-rose-600/15 px-3 py-1.5 text-sm font-semibold text-amber-600 transition hover:from-amber-500/25 hover:to-rose-600/25 dark:text-amber-300"
        >
          <Crown className="size-3.5" /> {honorific?.title ?? "Master"} console
        </Link>
      )}
    </>
  );

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
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2 font-semibold">
                <BrandMark />
                <span className="hidden whitespace-nowrap sm:inline">AI Advertising Studio</span>
              </Link>
              {/* Wide screens: the nav sits inline. */}
              <nav className="hidden items-center gap-1 lg:flex">{navLinks}</nav>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
              <Link href="/credits" aria-label="Credits">
                <CreditBalanceWidget
                  balance={balance}
                  reserved={reserved}
                  unlimited={hasUnlimitedCredits(profile.role)}
                  tier={tier}
                  honorific={honorific}
                />
              </Link>
              <ThemeToggle />
              <Link
                href="/profile"
                aria-label="Profile"
                title={name}
                className="flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
              >
                {/* Phones get an initial; wider screens the name. */}
                <span className="flex size-8 items-center justify-center rounded-full border bg-muted text-xs font-semibold uppercase xl:hidden">
                  {tier ? <RoyalCrown tier={tier} honorific={honorific} className="size-3.5" /> : name.charAt(0)}
                </span>
                <span className="hidden max-w-40 items-center truncate xl:inline-flex">
                  {tier && <RoyalCrown tier={tier} honorific={honorific} className="mr-1 size-3.5" />}
                  {name}
                </span>
              </Link>
              <SignOutButton />
            </div>
          </div>
          {/* Narrower screens: the nav gets its own scrollable row. */}
          <nav className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden">{navLinks}</nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="relative border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} CovenX Solutions. All rights reserved.</p>
          <PoweredByCovenX />
        </div>
      </footer>
      <Toaster richColors position="top-right" />
    </div>
  );
}
