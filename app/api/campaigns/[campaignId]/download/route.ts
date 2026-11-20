import { NextResponse } from "next/server";
import { strToU8, zipSync, type Zippable } from "fflate";
import { createClient } from "@/lib/db/supabase/server";
import type { DesignSchema } from "@/lib/design-schema/types";
import { renderSchemaToPng } from "@/lib/design-schema/render/renderPng";
import { schemaInFormat } from "@/lib/orchestration/composition";
import { AD_FORMATS } from "@/lib/orchestration/formats";
import { adCopyText, adFileStem, playbookMarkdown } from "@/lib/campaign/playbook";
import type { CampaignPlan } from "@/lib/campaign/plan";

// Renders every ad in every placement size on demand — so the zip always
// reflects the latest saved edits — plus the playbook and each ad's copy.
export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, plan, products(name)")
    .eq("id", campaignId)
    .single();
  if (!campaign?.plan) return NextResponse.json({ error: "Campaign not ready" }, { status: 404 });
  const plan = campaign.plan as CampaignPlan;
  const productName = (campaign.products as unknown as { name: string } | null)?.name ?? "Product";

  const { data: projects } = await supabase
    .from("creative_projects")
    .select("id, design_schema")
    .eq("campaign_id", campaignId);
  const schemas = new Map((projects ?? []).map((p) => [p.id, p.design_schema as DesignSchema | null]));

  const files: Zippable = {
    "PLAYBOOK.md": strToU8(playbookMarkdown(plan, productName)),
  };
  for (const [i, ad] of plan.ads.entries()) {
    const stem = adFileStem(ad, i);
    files[`${stem}-copy.txt`] = strToU8(adCopyText(ad));
    const schema = schemas.get(ad.projectId);
    if (!schema) continue;
    for (const f of AD_FORMATS) {
      const png = await renderSchemaToPng(schemaInFormat(schema, f.id), { scale: 1 });
      // PNGs are already compressed; storing them skips pointless work.
      files[`${stem}-${f.id}-${f.width}x${f.height}.png`] = [new Uint8Array(png), { level: 0 }];
    }
  }

  const zip = zipSync(files);
  const name = productName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "campaign";
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${name}-campaign.zip"`,
    },
  });
}
