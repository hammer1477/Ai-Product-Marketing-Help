import Link from "next/link";
import { Download, Loader2, TriangleAlert } from "lucide-react";
import { angleById } from "@/lib/orchestration/angles";
import { isWorking, type ProjectCard } from "@/lib/jobs/projectStatus";
import { Badge } from "@/components/ui/badge";

export function AdCard({ card }: { card: ProjectCard }) {
  const angle = angleById(card.angle);
  const working = isWorking(card.status);
  const ratio = card.width && card.height ? `${card.width} / ${card.height}` : "1 / 1";

  return (
    <div className="group flex flex-col gap-2">
      <Link
        href={`/creative-projects/${card.id}`}
        className="relative block overflow-hidden rounded-lg border bg-muted"
        style={{ aspectRatio: ratio }}
      >
        {card.imageUrl ? (
          // Public generated-images URL; plain img keeps it off the optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={angle ? `${angle.label} ad` : "Ad"} className="h-full w-full object-cover transition group-hover:opacity-90" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-muted-foreground">
            {working ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                {card.status === "pending" ? "Queued" : "Designing…"}
              </>
            ) : card.status === "failed" ? (
              <>
                <TriangleAlert className="size-5 text-destructive" />
                Failed — credits refunded
              </>
            ) : (
              "Not generated yet"
            )}
          </div>
        )}
        {working && card.imageUrl && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
            <Loader2 className="size-3 animate-spin" /> Regenerating
          </span>
        )}
      </Link>
      <div className="flex items-center justify-between gap-2">
        {angle ? <Badge variant="outline">{angle.label}</Badge> : <span className="text-xs text-muted-foreground">{new Date(card.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        {card.imageUrl && (
          <a href={card.imageUrl} download className="text-muted-foreground hover:text-foreground" aria-label="Download PNG" title="Download PNG">
            <Download className="size-4" />
          </a>
        )}
      </div>
      {card.status === "failed" && card.error && !card.imageUrl && (
        <p className="line-clamp-2 text-xs text-muted-foreground" title={card.error}>{card.error}</p>
      )}
    </div>
  );
}
