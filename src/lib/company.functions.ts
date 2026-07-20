import { createServerFn } from "@tanstack/react-start";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getGatewayModel } from "./ai-gateway.server";

function tryParseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

const VoiceOutput = z.object({
  opening: z.string(),
  observations: z.array(z.string()),
});

async function assertSteward(
  supabase: any,
  userId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data.role !== "steward" && data.role !== "owner")) {
    throw new Error("Only stewards can do that.");
  }
}

async function assertMember(
  supabase: any,
  userId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not a member of this company.");
}

/**
 * Steward triggers: read all materials + recent feedback → produce a fresh
 * voice portrait. Saved as pending_voice. If no approved_voice yet, auto-approve.
 */
export const synthesizeCompanyVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ companyId: z.string().uuid(), rationale: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSteward(supabase, userId, data.companyId);

    const [materialsRes, feedbackRes, companyRes] = await Promise.all([
      supabase
        .from("voice_materials")
        .select("title, content")
        .eq("company_id", data.companyId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("voice_feedback")
        .select("learned")
        .eq("company_id", data.companyId)
        .not("learned", "is", null)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("companies").select("name, approved_voice").eq("id", data.companyId).single(),
    ]);

    const materials = (materialsRes.data ?? [])
      .map((m: any) => `— ${m.title}\n"""${(m.content ?? "").slice(0, 1500)}"""`)
      .join("\n\n");
    const learned = (feedbackRes.data ?? [])
      .map((f: any) => f.learned)
      .filter(Boolean)
      .join("\n- ");
    const name = companyRes.data?.name ?? "the company";

    const model = getGatewayModel();
    const system = `You are Voice Within — the institutional memory of how a specific company communicates.
You read what the company has written and how its team has been choosing drafts, and you distil a portrait of the company's voice.
No jargon. No hype. No AI language. Each observation is one short sentence, present tense, starting with "We" — specific enough to catch someone off guard because it's true.
Cover: what they lead with, what words they refuse, sentence rhythm, tone toward customers, and one belief that shapes everything.`;
    const prompt = `Company: ${name}

Writing samples (what they've actually published):
${materials || "(none yet — infer from the learned patterns below only)"}

What the team has been teaching me by picking drafts:
${learned ? "- " + learned : "(nothing yet)"}

Return JSON: { "opening": string (one line, under 14 words, present tense, starts with "We"), "observations": string[] (6–8 short sentences, each starts with "We") }.`;

    let voice: { opening: string; observations: string[] };
    try {
      const { object } = await generateObject({ model, schema: VoiceOutput, system, prompt });
      voice = { opening: object.opening, observations: object.observations.slice(0, 8) };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        const parsed = tryParseJson(err.text) as { opening?: string; observations?: string[] } | null;
        if (parsed?.opening && Array.isArray(parsed.observations)) {
          voice = { opening: parsed.opening, observations: parsed.observations.slice(0, 8) };
        } else throw err;
      } else throw err;
    }

    const currentApproved = companyRes.data?.approved_voice as
      | { opening?: string; observations?: string[] }
      | null;
    const hasApproved = !!currentApproved?.observations?.length;

    if (!hasApproved) {
      // First pass: auto-approve
      const { error: updErr } = await supabase
        .from("companies")
        .update({ approved_voice: voice, pending_voice: null, voice_status: "approved" })
        .eq("id", data.companyId);
      if (updErr) throw new Error(updErr.message);
      return { ...voice, auto_approved: true };
    }

    // Save as pending + create a voice_update record for approval
    const { error: updErr } = await supabase
      .from("companies")
      .update({ pending_voice: voice, voice_status: "pending_review" })
      .eq("id", data.companyId);
    if (updErr) throw new Error(updErr.message);

    await supabase.from("voice_updates").insert({
      company_id: data.companyId,
      created_by: userId,
      proposal: voice,
      rationale: data.rationale ?? "Refresh based on new materials and team choices.",
      status: "pending",
    });

    return { ...voice, auto_approved: false };
  });

export const approvePendingVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ companyId: z.string().uuid(), updateId: z.string().uuid().optional(), decision: z.enum(["approve", "reject"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSteward(supabase, userId, data.companyId);

    if (data.decision === "approve") {
      const { data: c, error } = await supabase
        .from("companies")
        .select("pending_voice")
        .eq("id", data.companyId)
        .single();
      if (error) throw new Error(error.message);
      if (!c?.pending_voice) throw new Error("Nothing pending.");
      await supabase
        .from("companies")
        .update({ approved_voice: c.pending_voice, pending_voice: null, voice_status: "approved" })
        .eq("id", data.companyId);
    } else {
      await supabase
        .from("companies")
        .update({ pending_voice: null, voice_status: "approved" })
        .eq("id", data.companyId);
    }

    if (data.updateId) {
      await supabase
        .from("voice_updates")
        .update({
          status: data.decision === "approve" ? "approved" : "rejected",
          decided_by: userId,
          decided_at: new Date().toISOString(),
        })
        .eq("id", data.updateId);
    }
    return { ok: true };
  });

const VariationsOutput = z.object({
  variations: z.array(z.object({ label: z.string(), text: z.string() })),
});

export const generateCompanyDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ companyId: z.string().uuid(), brief: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.companyId);

    const [companyRes, feedbackRes] = await Promise.all([
      supabase.from("companies").select("name, approved_voice").eq("id", data.companyId).single(),
      supabase
        .from("voice_feedback")
        .select("learned")
        .eq("company_id", data.companyId)
        .not("learned", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (companyRes.error) throw new Error(companyRes.error.message);

    const voice = (companyRes.data.approved_voice ?? {}) as {
      opening?: string;
      observations?: string[];
    };
    const memory = (feedbackRes.data ?? []).map((f: any) => f.learned).filter(Boolean);
    const observations = voice.observations ?? [];

    const model = getGatewayModel();
    const system = `You write in a company's voice. You have a portrait of who they are.
Follow every observation. Honour every memory. Write like them, not like a marketer or an AI assistant.
Rules:
- No hype. No emoji. No em-dash decoration. No "In today's world".
- Vary the three drafts in shape — one direct, one more narrative, one shorter and sharper — but all unmistakably them.
- Label each variation with a 1-2 word name describing its shape (e.g. "Direct", "Story", "Sharp").`;
    const prompt = `Company: ${companyRes.data.name}

Who they are:
${observations.length ? observations.map((o) => "- " + o).join("\n") : "(voice not yet defined — infer minimal, human, direct)"}

What the team has taught me since:
${memory.length ? memory.map((m) => "- " + m).join("\n") : "(nothing yet)"}

Brief:
${data.brief}

Return JSON: { "variations": [{ "label": string, "text": string }, ...] } with exactly 3 variations.`;
    try {
      const { object } = await generateObject({ model, schema: VariationsOutput, system, prompt });
      return { variations: object.variations.slice(0, 3) };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        const parsed = tryParseJson(err.text) as {
          variations?: Array<{ label: string; text: string }>;
        } | null;
        if (parsed?.variations?.length) return { variations: parsed.variations.slice(0, 3) };
      }
      throw err;
    }
  });

const LearnOutput = z.object({ memory: z.string() });

export const recordCompanyChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        brief: z.string(),
        chosen: z.string(),
        others: z.array(z.string()),
        reason: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, userId, data.companyId);

    const model = getGatewayModel();
    const system = `You are Voice Within, building a long-term understanding of a company's voice.
Given what a team member chose and why, distil ONE durable observation about how this company communicates.
One sentence. Present tense. Starts with "We". Specific, not generic. Under 18 words.
Return JSON: { "memory": string }.`;
    const prompt = `Brief: ${data.brief}

They chose:
"""${data.chosen}"""

Over:
${data.others.map((o) => `"""${o}"""`).join("\n\n")}

Why: ${data.reason || "(no reason given)"}`;
    let memory = "";
    try {
      const { object } = await generateObject({ model, schema: LearnOutput, system, prompt });
      memory = object.memory;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err) && err.text) {
        const parsed = tryParseJson(err.text) as { memory?: string } | null;
        memory = parsed?.memory ?? err.text.trim().slice(0, 200);
      }
    }

    await supabase.from("voice_feedback").insert({
      company_id: data.companyId,
      user_id: userId,
      brief: data.brief,
      chosen_text: data.chosen,
      other_texts: data.others,
      reason: data.reason || null,
      learned: memory || null,
    });

    return { memory };
  });