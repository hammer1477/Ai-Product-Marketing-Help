"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/db/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out" title="Sign out" className="px-2 sm:px-2.5">
      <LogOut className="size-4 sm:hidden" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
