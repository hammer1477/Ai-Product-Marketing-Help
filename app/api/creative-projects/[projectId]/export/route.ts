import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { renderSchemaToPng } from "@/lib/design-schema/render/renderPng";
import { renderSchemaToSvg } from "@/lib/design-schema/render/renderSvg";

/**
 * Raster scales offered. 2x is the web/social default; 4x puts a 1080
 * canvas at 4320px, which is a 14-inch print at 300dpi.
 */
const MAX_SCALE = 4;
const DEFAULT_SCALE = 2;

// On-demand export of the project's *current* (possibly user-edited) Design
// Schema — always re-renders from scratch rather than serving a cached
// generated_images row, so edits are reflected immediately.
//
//   ?format=svg          vector, resolution-independent
//   ?format=png&scale=4  raster at 4x canvas size
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error } = await supabase
    .from("creative_projects")
    .select("design_schema")
    .eq("id", projectId)
    .single();

  if (error || !project?.design_schema) {
    return NextResponse.json({ error: "No design to export yet" }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";

  if (format === "svg") {
    const svg = await renderSchemaToSvg(project.design_schema);
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "content-disposition": `attachment; filename="creative-${projectId}.svg"`,
      },
    });
  }

  // Clamped rather than trusted: scale drives an allocation of
  // (1080 * scale)^2 * 4 bytes, so an unbounded value from the query
  // string is a way to ask the server for a 100GB buffer.
  const requestedScale = Number(url.searchParams.get("scale"));
  const scale =
    Number.isFinite(requestedScale) && requestedScale >= 1
      ? Math.min(requestedScale, MAX_SCALE)
      : DEFAULT_SCALE;

  const png = await renderSchemaToPng(project.design_schema, { scale });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="creative-${projectId}@${scale}x.png"`,
    },
  });
}
