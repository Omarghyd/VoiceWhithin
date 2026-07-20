import { createServerFn } from "@tanstack/react-start";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getGatewayModel } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertUnderLimit, recordUsage } from "./usage.server";

type GenObjResult = { usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number } };
function tokensOf(r: GenObjResult): number {
  const u = r.usage;
  if (!u) return 0;
  if (typeof u.totalTokens === "number") return u.totalTokens;
  return (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
}

// -------- Voice profile (server-side persistence) --------

const ProfileInput = z.object({
  opening: z.string().default(""),
  observations: z.array(z.string()).default([]),
  memory: z.array(z.string()).default([]),
});

export const saveMyVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as never as {
      from: (t: string) => {
        upsert: (v: unknown, o: { onConflict: string }) => Promise<{ error: unknown }>;
      };
    })
      .from("user_voice_profiles")
      .upsert(
        {
          user_id: userId,
          opening: data.opening,
          observations: data.observations,
          memory: data.memory,
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const getMyVoiceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as never as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string,
          ) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    })
      .from("user_voice_profiles")
      .select("opening, observations, memory")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as {
      opening: string;
      observations: string[];
      memory: string[];
    } | null;
  });

// -------- Lending: grants --------

const CreateGrantInput = z.object({
  collaborator_email: z.string().email(),
  relationship_label: z.string().max(80).default(""),
  scope: z.enum(["all", "linkedin", "email", "longform"]).default("all"),
  autonomy: z
    .enum(["always_approve", "auto_short_replies", "off"])
    .default("always_approve"),
});

type SupaClient = {
  from: (t: string) => {
    insert: (v: unknown) => {
      select: (c: string) => {
        single: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        order: (
          c: string,
          o: { ascending: boolean },
        ) => Promise<{ data: unknown; error: unknown }>;
        eq?: (k: string, v: string) => unknown;
      };
      order: (
        c: string,
        o: { ascending: boolean },
      ) => Promise<{ data: unknown; error: unknown }>;
    };
    update: (v: unknown) => {
      eq: (
        k: string,
        v: string,
      ) => Promise<{ error: unknown }>;
    };
  };
};

export const createGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateGrantInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { data: inserted, error } = await supabase
      .from("lending_grants")
      .insert({
        owner_id: context.userId,
        collaborator_email: data.collaborator_email.toLowerCase(),
        relationship_label: data.relationship_label,
        scope: data.scope,
        autonomy: data.autonomy,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw error;
    return inserted as { id: string };
  });

export const listMyGrantsAsOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { data, error } = await supabase
      .from("lending_grants")
      .select(
        "id, collaborator_email, relationship_label, scope, autonomy, status, created_at, activated_at, revoked_at",
      )
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      collaborator_email: string;
      relationship_label: string;
      scope: string;
      autonomy: string;
      status: string;
      created_at: string;
      activated_at: string | null;
      revoked_at: string | null;
    }>;
  });

export const listGrantsForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { data, error } = await supabase
      .from("lending_grants")
      .select("id, owner_id, relationship_label, scope, autonomy, status")
      .eq("collaborator_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      owner_id: string;
      relationship_label: string;
      scope: string;
      autonomy: string;
      status: string;
    }>;
  });

const RevokeInput = z.object({ grantId: z.string().uuid() });

export const revokeGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RevokeInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { error } = await supabase
      .from("lending_grants")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.grantId);
    if (error) throw error;
    return { ok: true };
  });

// Called by the collaborator on entering /studio/lend — activates any
// grants that were pending against their email.
export const claimGrantsForMyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as {
      from: (t: string) => {
        update: (v: unknown) => {
          eq: (
            k: string,
            v: string,
          ) => {
            eq: (
              k: string,
              v: string,
            ) => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) return { claimed: 0 };
    const { error } = await supabase
      .from("lending_grants")
      .update({
        collaborator_id: context.userId,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("collaborator_email", email.toLowerCase())
      .eq("status", "pending");
    if (error) throw error;
    return { ok: true };
  });

// -------- Lending: drafts (approval queue) --------

export const listApprovalQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { data, error } = await supabase
      .from("lending_drafts")
      .select(
        "id, grant_id, brief, draft_text, status, owner_note, created_at, decided_at",
      )
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      grant_id: string;
      brief: string;
      draft_text: string;
      status: string;
      owner_note: string | null;
      created_at: string;
      decided_at: string | null;
    }>;
  });

const DecideInput = z.object({
  draftId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  note: z.string().max(400).default(""),
});

export const decideDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DecideInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { error } = await supabase
      .from("lending_drafts")
      .update({
        status: data.decision,
        owner_note: data.note || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.draftId);
    if (error) throw error;
    return { ok: true };
  });

// Collaborator generates + submits a draft in the owner's voice.
const LentDraftInput = z.object({
  grantId: z.string().uuid(),
  brief: z.string().min(1),
});

const LentDraftOutput = z.object({
  draft: z.string(),
});

export const draftAndSubmitForOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LentDraftInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertUnderLimit(context.userId);
    const supabase = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string,
          ) => {
            eq: (
              k: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
            single?: () => Promise<{ data: unknown; error: unknown }>;
            maybeSingle?: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
        insert: (v: unknown) => {
          select: (c: string) => {
            single: () => Promise<{ data: unknown; error: unknown }>;
          };
        };
      };
    };
    // Fetch grant to confirm active + get owner_id
    const { data: grant, error: gErr } = await supabase
      .from("lending_grants")
      .select("owner_id, status")
      .eq("id", data.grantId)
      .eq("collaborator_id", context.userId)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!grant) throw new Error("Grant not found.");
    const g = grant as { owner_id: string; status: string };
    if (g.status !== "active") throw new Error("Grant is not active.");

    // Read the owner's voice profile (RLS lets us because the grant is active)
    const readClient = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string,
          ) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
        };
      };
    };
    const { data: profile } = await readClient
      .from("user_voice_profiles")
      .select("opening, observations, memory")
      .eq("user_id", g.owner_id)
      .maybeSingle();
    const p = (profile as {
      opening: string;
      observations: string[];
      memory: string[];
    } | null) ?? { opening: "", observations: [], memory: [] };

    const model = getGatewayModel();
    const system = `You write in someone else's voice. Never a marketer, never a chatbot. Follow every observation. Honour every memory.
Rules: no hype, no emoji, no em-dashes, no "in today's world". Present tense. Short sentences where they land harder. One draft only.`;
    const prompt = `Who they are:\n${p.observations.map((o) => "- " + o).join("\n") || "(no observations yet)"}\n\nWhat they have taught since:\n${p.memory.map((m) => "- " + m).join("\n") || "(nothing yet)"}\n\nBrief from a person drafting on their behalf:\n${data.brief}\n\nReturn JSON: { "draft": string }.`;

    let draftText = "";
    try {
      const result = await generateObject({
        model,
        schema: LentDraftOutput,
        system,
        prompt,
      });
      await recordUsage(context.userId, tokensOf(result));
      draftText = result.object.draft;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        draftText = err.text.trim();
      } else {
        throw err;
      }
    }

    const { data: inserted, error: iErr } = await supabase
      .from("lending_drafts")
      .insert({
        grant_id: data.grantId,
        owner_id: g.owner_id,
        collaborator_id: context.userId,
        brief: data.brief,
        draft_text: draftText,
        status: "pending",
      })
      .select("id")
      .single();
    if (iErr) throw iErr;
    return { ...(inserted as { id: string }), draft: draftText };
  });

// Collaborator's own draft history (so they see decisions).
export const listMySubmittedDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupaClient;
    const { data, error } = await supabase
      .from("lending_drafts")
      .select("id, grant_id, brief, draft_text, status, owner_note, created_at, decided_at")
      .eq("collaborator_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      grant_id: string;
      brief: string;
      draft_text: string;
      status: string;
      owner_note: string | null;
      created_at: string;
      decided_at: string | null;
    }>;
  });