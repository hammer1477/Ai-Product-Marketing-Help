import { createClient } from "@/lib/db/supabase/server";

export async function getCreditBalance(userId: string): Promise<{ balance: number; reserved: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_balances")
    .select("balance, reserved")
    .eq("user_id", userId)
    .maybeSingle();

  return { balance: data?.balance ?? 0, reserved: data?.reserved ?? 0 };
}
