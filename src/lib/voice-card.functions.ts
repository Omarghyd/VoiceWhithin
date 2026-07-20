import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type VoiceCardRow = {
  slug: string | null;
  is_public: boolean;
  display_name: string | null;
  opening: string | null;
  observations: unknown;
  signature_passage: string | null;
  published_at: string | null;
};

function toObservations(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

// Public: fetch a published card by slug. No auth required.
export const getPublicVoiceCard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(3).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Server not configured");
    const sb = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await (sb as never as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: boolean) => {
              maybeSingle: () => Promise<{ data: VoiceCardRow | null; error: unknown }>;
            };
          };
        };
      };
    })
      .from("user_voice_profiles")
      .select("slug, is_public, display_name, opening, observations, signature_passage, published_at")
      .eq("slug", data.slug)
      .eq("is_public", true)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return {
      slug: row.slug ?? data.slug,
      displayName: row.display_name ?? "Someone",
      opening: row.opening ?? "",
      observations: toObservations(row.observations),
      signaturePassage: row.signature_passage ?? "",
      publishedAt: row.published_at,
    };
  });

// Auth: get my card's share state.
export const getMyVoiceCardStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as never as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: VoiceCardRow | null; error: unknown }>;
          };
        };
      };
    })
      .from("user_voice_profiles")
      .select("slug, is_public, display_name, signature_passage, published_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return {
      slug: data?.slug ?? null,
      isPublic: !!data?.is_public,
      displayName: data?.display_name ?? "",
      signaturePassage: data?.signature_passage ?? "",
      publishedAt: data?.published_at ?? null,
    };
  });

// Auth: publish (or re-publish) the card. Mints a slug on first publish.
export const publishMyVoiceCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        displayName: z.string().min(1).max(60),
        signaturePassage: z.string().max(600).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    type Sb = {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { slug: string | null } | null; error: unknown }>;
          };
        };
        update: (v: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: unknown }>;
        };
      };
      rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>;
    };
    const sb = supabase as never as Sb;
    const { data: current, error: readErr } = await sb
      .from("user_voice_profiles")
      .select("slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw readErr;

    let slug = current?.slug ?? null;
    if (!slug) {
      const { data: newSlug, error: slugErr } = await sb.rpc("generate_voice_slug");
      if (slugErr) throw slugErr;
      slug = newSlug;
    }
    const { error: updErr } = await sb
      .from("user_voice_profiles")
      .update({
        slug,
        is_public: true,
        display_name: data.displayName,
        signature_passage: data.signaturePassage,
        published_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (updErr) throw updErr;
    return { slug };
  });

export const unpublishMyVoiceCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as never as {
      from: (t: string) => {
        update: (v: unknown) => {
          eq: (k: string, v: string) => Promise<{ error: unknown }>;
        };
      };
    })
      .from("user_voice_profiles")
      .update({ is_public: false })
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
