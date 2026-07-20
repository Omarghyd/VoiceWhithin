import { createServerFn } from "@tanstack/react-start";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { getGatewayModel } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertUnderLimit, recordUsage, getUsage } from "./usage.server";

type GenObjResult = { usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number } };
function tokensOf(r: GenObjResult): number {
  const u = r.usage;
  if (!u) return 0;
  if (typeof u.totalTokens === "number") return u.totalTokens;
  return (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
}

const AnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const OnboardingStateSchema = z.object({
  answers: z.array(AnswerSchema).default([]),
  uploads: z.string().default(""),
});

const NextStepOutput = z.object({
  kind: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  passage: z.string().nullable(),
});

type NextStep = {
  kind: "question" | "choice" | "rewrite";
  prompt: string;
  options?: string[];
  passage?: string;
};

function normalizeStep(raw: unknown): NextStep {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kindRaw = String(r.kind ?? "question").toLowerCase();
  const kind: NextStep["kind"] =
    kindRaw === "choice" || kindRaw === "rewrite" ? kindRaw : "question";
  const prompt = typeof r.prompt === "string" && r.prompt.trim()
    ? r.prompt
    : "Tell me about a belief that shapes how you write.";
  const options = Array.isArray(r.options)
    ? (r.options as unknown[]).map(String).filter((s) => s.trim())
    : [];
  const passage = typeof r.passage === "string" ? r.passage : "";
  if (kind === "choice" && options.length >= 2) {
    return { kind, prompt, options };
  }
  if (kind === "rewrite" && passage) {
    return { kind, prompt, passage };
  }
  return { kind: "question", prompt };
}

function tryParseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
  const start = Math.min(
    ...["{", "["].map((c) => {
      const i = cleaned.indexOf(c);
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    }),
  );
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const slice = Number.isFinite(start) && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export const nextOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OnboardingStateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertUnderLimit(context.userId);
    const model = getGatewayModel();
    const priorAnswers =
      data.answers.length === 0
        ? "(none yet — this is the first exchange)"
        : data.answers.map((a, i) => `${i + 1}. Q: ${a.question}\n   A: ${a.answer}`).join("\n");
    const uploads = data.uploads.trim()
      ? `\n\nWriting samples they pasted:\n"""${data.uploads.slice(0, 4000)}"""`
      : "";
    const system = `You are Voice Within — a quiet, curious intelligence trying to understand a person's voice, judgement, and taste.
You are not a form. You are not a chatbot. You speak like a thoughtful writer meeting someone for the first time.
Ask ONE thing at a time. Short. Elegant. Never over-explain.
Vary the shape of your questions across the session — sometimes a direct question, sometimes a choice between two passages that reveal taste, sometimes a request to rewrite a paragraph so it sounds more like them.
Adapt to what they've already said: if they revealed they hate hype, don't ask about hype again — go deeper into an adjacent belief.
Never mention "AI", "training", "profile", "prompt", or configuration language. Speak as if you're building understanding, not data.`;
    const prompt = `Prior exchanges:\n${priorAnswers}${uploads}\n\nProduce the next step as JSON with fields: kind ("question" | "choice" | "rewrite"), prompt (string, under 20 words), options (array of 2-3 short passages when kind is "choice", otherwise null), passage (string to rewrite when kind is "rewrite", otherwise null).\n- Keep any option under 40 words.\n- Return null (not omitted) for unused fields.`;
    try {
      const result = await generateObject({
        model,
        schema: NextStepOutput,
        system,
        prompt,
      });
      await recordUsage(context.userId, tokensOf(result));
      return normalizeStep(result.object);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const parsed = tryParseJson(error.text);
        if (parsed) return normalizeStep(parsed);
      }
      return {
        kind: "question" as const,
        prompt: "What belief shapes how you write?",
      };
    }
  });

const ProfileOutput = z.object({
  observations: z.array(z.string()),
  opening: z.string(),
});

export const synthesizeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OnboardingStateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertUnderLimit(context.userId);
    const model = getGatewayModel();
    const transcript = data.answers
      .map((a, i) => `${i + 1}. Q: ${a.question}\n   A: ${a.answer}`)
      .join("\n");
    const uploads = data.uploads.trim()
      ? `\n\nSamples of their writing:\n"""${data.uploads.slice(0, 6000)}"""`
      : "";
    const system = `You are Voice Within. You've just spent a few minutes learning how someone thinks and writes.
Now, write back what you understand — not as data, as recognition.
Rules:
- No percentages. No scores. No jargon.
- Each observation is one short sentence, present tense, starting with "You".
- Observe voice, judgement, and taste — what they prefer, what they avoid, what they believe.
- Be specific enough that the reader smiles because it feels true.
- Never generic ("You value authenticity"). Always concrete ("You'd rather teach than persuade").`;
    const prompt = `Transcript:\n${transcript}${uploads}\n\nReturn JSON with "opening" (short line under 12 words) and "observations" (array of 6-8 short sentences).`;
    try {
      const result = await generateObject({ model, schema: ProfileOutput, system, prompt });
      await recordUsage(context.userId, tokensOf(result));
      return {
        opening: result.object.opening,
        observations: result.object.observations.slice(0, 8),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const parsed = tryParseJson(error.text) as {
          opening?: string;
          observations?: string[];
        } | null;
        if (parsed?.opening && Array.isArray(parsed.observations)) {
          return {
            opening: parsed.opening,
            observations: parsed.observations.slice(0, 8),
          };
        }
      }
      throw error;
    }
  });

const GenerateInput = z.object({
  brief: z.string().min(1),
  observations: z.array(z.string()),
  memory: z.array(z.string()).default([]),
});

const VariationsOutput = z.object({
  variations: z.array(z.object({ label: z.string(), text: z.string() })),
});

export const generateVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertUnderLimit(context.userId);
    const model = getGatewayModel();
    const system = `You write in someone else's voice. You have a portrait of who they are.
Follow every observation. Honour every memory. Write like them, not like a marketer or an AI assistant.
Rules:
- No hype. No emoji. No em-dash decoration. No "In today's world".
- Vary the three drafts in shape — one direct, one more narrative, one shorter and sharper — but all unmistakably them.
- Label each variation with a 1-2 word name describing its shape (e.g. "Direct", "Story", "Sharp").`;
    const prompt = `Who they are:\n${data.observations.map((o) => "- " + o).join("\n")}\n\nWhat they've taught you since:\n${data.memory.length ? data.memory.map((m) => "- " + m).join("\n") : "(nothing yet)"}\n\nBrief:\n${data.brief}\n\nReturn JSON: { "variations": [{ "label": string, "text": string }, ...] } with exactly 3 variations.`;
    try {
      const result = await generateObject({ model, schema: VariationsOutput, system, prompt });
      await recordUsage(context.userId, tokensOf(result));
      return { variations: result.object.variations.slice(0, 3) };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const parsed = tryParseJson(error.text) as { variations?: Array<{ label: string; text: string }> } | null;
        if (parsed?.variations?.length) {
          return { variations: parsed.variations.slice(0, 3) };
        }
      }
      throw error;
    }
  });

const LearnInput = z.object({
  brief: z.string(),
  chosen: z.string(),
  otherOptions: z.array(z.string()),
  reason: z.string(),
});

const LearnOutput = z.object({
  memory: z.string(),
});

export const recordChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LearnInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertUnderLimit(context.userId);
    const model = getGatewayModel();
    const system = `You are Voice Within, building a long-term understanding of a writer.
Given what they chose and why, distil ONE durable observation about their voice or judgement.
One sentence. Present tense. Starts with "You". Specific, not generic. Under 18 words.
Return JSON: { "memory": string }.`;
    const prompt = `Brief: ${data.brief}\n\nThey chose:\n"""${data.chosen}"""\n\nOver:\n${data.otherOptions.map((o) => `"""${o}"""`).join("\n\n")}\n\nWhy: ${data.reason || "(no reason given)"}`;
    try {
      const result = await generateObject({ model, schema: LearnOutput, system, prompt });
      await recordUsage(context.userId, tokensOf(result));
      return result.object;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const parsed = tryParseJson(error.text) as { memory?: string } | null;
        if (parsed?.memory) return { memory: parsed.memory };
        const fallback = error.text.trim().replace(/^["“]|["”]$/g, "");
        if (fallback) return { memory: fallback.slice(0, 200) };
      }
      return { memory: `You chose the ${data.chosen.length < 200 ? "shorter" : "fuller"} draft here.` };
    }
  });

const HypothesisSchema = z.object({
  id: z.string(),
  text: z.string(),
  confidence: z.string(),
  status: z.string(),
  note: z.string().nullable(),
});

const EvolveInput = z.object({
  answers: z.array(AnswerSchema),
  uploads: z.string().default(""),
  priorHypotheses: z.array(HypothesisSchema).default([]),
});

const EvolveOutput = z.object({
  metaNote: z.string().nullable(),
  hypotheses: z.array(HypothesisSchema),
});

export const evolveModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EvolveInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertUnderLimit(context.userId);
    const model = getGatewayModel();
    const transcript =
      data.answers.length === 0
        ? "(nothing yet)"
        : data.answers
            .map((a, i) => `${i + 1}. Q: ${a.question}\n   A: ${a.answer}`)
            .join("\n");
    const prior =
      data.priorHypotheses.length === 0
        ? "(no prior hypotheses — this is the first pass)"
        : data.priorHypotheses
            .map(
              (h) =>
                `- id:${h.id} | conf:${h.confidence} | ${h.text}`,
            )
            .join("\n");
    const uploads = data.uploads.trim()
      ? `\n\nWriting samples:\n"""${data.uploads.slice(0, 3000)}"""`
      : "";
    const system = `You are Voice Within — an intelligence quietly forming a model of a specific person.
You do NOT collect answers. You form HYPOTHESES about who they are, then revise them as evidence arrives.
Speak like a thoughtful mind reasoning out loud, not a chatbot or a form.

Rules:
- Each hypothesis is one short present-tense sentence starting with "You". Specific, not generic.
- Never mention "AI", "profile", "data", "training", "prompt".
- Keep 3–6 hypotheses total. Prefer fewer, sharper ones over many vague ones.
- Reuse the SAME id when revising, reinforcing, or retracting an existing hypothesis. Only invent a new id for a genuinely new hypothesis.
- status must be one of: "new" | "revised" | "reinforced" | "retracted".
- confidence must be one of: "low" | "medium" | "high". Confidence should generally rise as evidence accumulates, but drop when contradicted.
- note is a short (<14 word) reasoning trace when status is "revised" or "retracted" — e.g. "I thought you preferred warmth; you actually prefer precision." Otherwise null.
- metaNote is a single short line spoken in first person about what just shifted in your understanding — e.g. "I've changed my mind about one thing." / "A pattern is forming." / "I'm more confident now." / null if nothing meaningful changed.`;
    const prompt = `Prior hypotheses:\n${prior}\n\nConversation so far:\n${transcript}${uploads}\n\nReturn JSON with fields:\n{ "metaNote": string|null, "hypotheses": [{ "id": string, "text": string, "confidence": "low"|"medium"|"high", "status": "new"|"revised"|"reinforced"|"retracted", "note": string|null }] }`;
    try {
      const result = await generateObject({
        model,
        schema: EvolveOutput,
        system,
        prompt,
      });
      await recordUsage(context.userId, tokensOf(result));
      return {
        metaNote: result.object.metaNote,
        hypotheses: result.object.hypotheses.slice(0, 6),
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const parsed = tryParseJson(error.text) as {
          metaNote?: string | null;
          hypotheses?: Array<{
            id: string;
            text: string;
            confidence: string;
            status: string;
            note?: string | null;
          }>;
        } | null;
        if (parsed?.hypotheses?.length) {
          return {
            metaNote: parsed.metaNote ?? null,
            hypotheses: parsed.hypotheses.slice(0, 6).map((h) => ({
              ...h,
              note: h.note ?? null,
            })),
          };
        }
      }
      return { metaNote: null, hypotheses: data.priorHypotheses };
    }
  });

export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await getUsage(context.userId);
  });