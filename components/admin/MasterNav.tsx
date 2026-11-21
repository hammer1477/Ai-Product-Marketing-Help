"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Images, LayoutDashboard, Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Subjects", icon: Users },
  { href: "/admin/generations", label: "Generations", icon: Images },
  { href: "/admin/products", label: "Products", icon: Package },
];

export function MasterNav({ title = "Master" }: { title?: string }) {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2">
      <span className="mr-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Crown className="size-4" /> {title} console
      </span>
      {TABS.map((t) => {
        const on = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition",
              on
                ? "border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-rose-700/25 font-semibold text-amber-100"
                : "border-amber-500/15 text-rose-100/70 hover:border-amber-400/40 hover:text-amber-100",
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
