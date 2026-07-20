import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const joinTeamsWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase
      .from("teams_waitlist")
      .insert({ email: data.email.toLowerCase().trim(), note: data.note ?? null });
    // Ignore unique-violation — treat repeat signups as success.
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error("Couldn't save. Try again in a moment.");
    }
    return { ok: true };
  });