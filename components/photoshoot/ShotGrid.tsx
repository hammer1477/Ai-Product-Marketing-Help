import Link from "next/link";
import { Download, Loader2, TriangleAlert } from "lucide-react";

export type Shot = {
  id: string;
  url: string;
  scene: string;
  width: number;
  height: number;
  productName?: string;
  productId?: string;
};
export type PendingShot = { id: string; status: string; error: string | null; scene: string };

export function ShotGrid({ shots, pending = [] }: { shots: Shot[]; pending?: PendingShot[] }) {
  if (shots.length === 0 && pending.length === 0) {
    return <p className="text-sm text-muted-foreground">No shots yet.</p>;
  }
  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
      {pending.map((p) => (
        <div
          key={p.id}
          className="flex aspect-square break-inside-avoid flex-col items-center justify-center gap-2 rounded-lg border bg-muted p-4 text-center text-xs text-muted-foreground"
          title={p.error ?? undefined}
        >
          {p.status === "failed" ? (
            <>
              <TriangleAlert className="size-5 text-destructive" />
              {p.scene}: failed, credits refunded
            </>
          ) : (
            <>
              <Loader2 className="size-5 animate-spin" />
              {p.status === "pending" ? "Queued" : "Shooting"} · {p.scene}
            </>
          )}
        </div>
      ))}
      {shots.map((shot) => (
        <figure key={shot.id} className="group break-inside-avoid">
          <a href={shot.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
            {/* Public generated-images URL; a plain img keeps it off the optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.url}
              alt={shot.scene}
              width={shot.width}
              height={shot.height}
              className="h-auto w-full transition group-hover:opacity-90"
              loading="lazy"
            />
          </a>
          <figcaption className="mt-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">
              {shot.productName && shot.productId && (
                <>
                  <Link href={`/products/${shot.productId}/photoshoot`} className="font-medium text-foreground hover:underline">
                    {shot.productName}
                  </Link>
                  {" · "}
                </>
              )}
              {shot.scene}
            </span>
            <a href={shot.url} download className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Download" title="Download">
              <Download className="size-4" />
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
