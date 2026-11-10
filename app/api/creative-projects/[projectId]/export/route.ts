import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { renderSchemaToPng } from "@/lib/design-schema/render/renderPng";

// On-demand high-res export of the project's *current* (possibly
// user-edited) Design Schema — always re-renders from scratch rather than
// serving a cached generated_images row, so edits are reflected immediately.
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
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

  const png = await renderSchemaToPng(project.design_schema, { scale: 2 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="creative-${projectId}.png"`,
    },
  });
}
