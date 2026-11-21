import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/db/supabase/server";
import { getProfile } from "@/lib/profile/getProfile";

/**
 * Serves the Master console's posters from private/posters, to the owner
 * only. Unlike files in public/, these can't be opened by anyone who guesses
 * the URL. Drop a file named `<slot>.<ext>` in private/posters (e.g.
 * small.jpg, big.gif); animated GIF/WebP play as-is.
 */
const SLOTS = new Set(["small", "big", "third", "fourth", "fifth"]);
/** SHA-256 of specific images this route won't serve. */
const BLOCKED = new Set(["c268483cc677a32078096b7d77f6305fc066052ca4e1056bcb399533af491f6d"]);
const TYPES: Record<string, string> = {
  gif: "image/gif",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  avif: "image/avif",
};
const DIR = path.join(process.cwd(), "private", "posters");

export async function GET(_req: Request, { params }: { params: Promise<{ slot: string }> }) {
  const { slot } = await params;
  if (!SLOTS.has(slot)) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await getProfile(user.id)).role !== "owner") return new Response(null, { status: 404 });

  for (const [ext, type] of Object.entries(TYPES)) {
    try {
      const file = await fs.readFile(path.join(DIR, `${slot}.${ext}`));
      if (BLOCKED.has(createHash("sha256").update(file).digest("hex"))) return new Response(null, { status: 404 });
      return new Response(new Uint8Array(file), {
        headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" },
      });
    } catch {
      // Not this extension — try the next.
    }
  }
  return new Response(null, { status: 404 });
}
