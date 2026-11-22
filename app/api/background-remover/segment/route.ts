import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { cloudProvider, segmentToMask, SegmentError, validateSegmentInput } from "@/lib/background-remover/server";

export const maxDuration = 60;

// Feature 4 — Product Background Remover. Takes a (client-downscaled)
// product photo and returns a greyscale PNG transparency mask from a
// dedicated background-removal model. Never returns generated pixels.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = cloudProvider();
  if (!provider) {
    return NextResponse.json({ error: "No cloud provider configured.", fallback: "browser" }, { status: 501 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image uploaded." }, { status: 400 });

  try {
    const input = await validateSegmentInput(file);
    const mask = await segmentToMask(provider, input);
    return new NextResponse(new Uint8Array(mask), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Mask-Width": String(input.width),
        "X-Mask-Height": String(input.height),
      },
    });
  } catch (err) {
    if (err instanceof SegmentError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[background-remover] segment failed", err);
    return NextResponse.json({ error: "Background removal failed." }, { status: 500 });
  }
}
