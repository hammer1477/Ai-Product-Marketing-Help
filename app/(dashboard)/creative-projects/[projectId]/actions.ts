"use server";

import { createClient } from "@/lib/db/supabase/server";
import type { DesignSchema } from "@/lib/design-schema/types";
import { validateDesignSchema } from "@/lib/design-schema/validate";

export async function saveDesignSchema(projectId: string, schema: DesignSchema) {
  const issues = validateDesignSchema(schema);

  const supabase = await createClient();
  const { error } = await supabase
    .from("creative_projects")
    .update({ design_schema: schema })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  // No revalidatePath: the editor already holds what was saved, and a
  // refresh would remount it — wiping undo history mid-session. Pages that
  // list this project read it fresh on their next visit.
  return { issues };
}
