import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { angleById } from "@/lib/orchestration/angles";
import { cn } from "@/lib/utils";

// Building blocks for the master console's oxblood-and-gold pages.

export function Panel({ title, icon: Icon, action, children, className }: {
  title?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl border border-amber-500/15 bg-black/30 p-5", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 font-semibold text-amber-100">
              {Icon && <Icon className="size-4 text-amber-400" />} {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400/80">{eyebrow}</p>
      <h1 className="mt-1 bg-gradient-to-r from-amber-200 via-amber-400 to-rose-400 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
        {title}
      </h1>
      {sub && <p className="mt-1 text-sm text-rose-100/60">{sub}</p>}
    </div>
  );
}

export function Muted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-rose-100/50", className)}>{children}</span>;
}

export const goldLink = "text-amber-300 underline-offset-4 hover:underline";

/** One picture of a generation: ad, campaign ad or photoshoot shot. */
export function Tile({
  url,
  width,
  height,
  title,
  meta,
  href,
}: {
  url: string | null;
  width: number;
  height: number;
  title: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
}) {
  return (
    <figure className="group flex break-inside-avoid flex-col gap-1.5">
      <div className="relative overflow-hidden rounded-xl border border-amber-500/15 bg-black/40" style={{ aspectRatio: `${width} / ${height}` }}>
        {url ? (
          // Public bucket URLs; a plain img keeps them off the optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-rose-100/40">Not rendered</div>
        )}
        {url && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <a href={url} target="_blank" rel="noreferrer" className="rounded-md bg-black/70 p-1.5 text-amber-200" title="Open full size">
              <ExternalLink className="size-3.5" />
            </a>
            <a href={url} download className="rounded-md bg-black/70 p-1.5 text-amber-200" title="Download">
              <Download className="size-3.5" />
            </a>
          </div>
        )}
      </div>
      <figcaption className="min-w-0 text-xs">
        <p className="truncate font-medium text-amber-50">{href ? <Link href={href} className={goldLink}>{title}</Link> : title}</p>
        {meta && <p className="truncate text-rose-100/50">{meta}</p>}
      </figcaption>
    </figure>
  );
}

export function angleName(angle: string | null): string {
  return angleById(angle)?.label ?? "Ad";
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
