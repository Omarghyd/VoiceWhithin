// Server-only usage accounting. Enforces a monthly token cap per user so a
// single Creator subscription can't run away with our AI bill.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// £20/mo revenue vs Gemini pricing → ~500k tokens/month gives us comfortable
// margin for typical drafting usage. Tunable in one place.
export const MONTHLY_TOKEN_LIMIT = 500_000;

function periodStart(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type UsageSnapshot = {
  tokensUsed: number;
  limit: number;
  remaining: number;
  periodStart: string;
};

export async function getUsage(userId: string): Promise<UsageSnapshot> {
  const db = admin();
  const period = periodStart();
  const { data } = await db
    .from("user_usage")
    .select("tokens_used")
    .eq("user_id", userId)
    .eq("period_start", period)
    .maybeSingle();
  const tokensUsed = data?.tokens_used ?? 0;
  return {
    tokensUsed,
    limit: MONTHLY_TOKEN_LIMIT,
    remaining: Math.max(0, MONTHLY_TOKEN_LIMIT - tokensUsed),
    periodStart: period,
  };
}

export async function assertUnderLimit(userId: string): Promise<void> {
  const { tokensUsed, limit } = await getUsage(userId);
  if (tokensUsed >= limit) {
    throw new Error(
      "You've reached this month's usage limit. It resets on the 1st of next month.",
    );
  }
}

export async function recordUsage(userId: string, tokens: number): Promise<void> {
  if (!tokens || tokens <= 0) return;
  const db = admin();
  const period = periodStart();
  // Upsert then increment via RPC-less flow: try update, insert on 0 rows.
  const { data: existing } = await db
    .from("user_usage")
    .select("id, tokens_used")
    .eq("user_id", userId)
    .eq("period_start", period)
    .maybeSingle();
  if (existing) {
    await db
      .from("user_usage")
      .update({ tokens_used: (existing.tokens_used ?? 0) + tokens })
      .eq("id", existing.id);
  } else {
    await db.from("user_usage").insert({
      user_id: userId,
      period_start: period,
      tokens_used: tokens,
    });
  }
}