import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { generateText } from "ai";
import { z } from "zod";
import { createHash } from "crypto";
import { getGatewayModel } from "./ai-gateway.server";

const Input = z.object({
  sample: z.string().min(120, "Paste at least a paragraph you actually wrote.").max(4000),
  brief: z.string().min(3).max(240).default("Announce that we just shipped a big new feature."),
});

const SYSTEM_GENERIC = `You are a typical corporate LinkedIn AI writer. Write a short post (60-90 words) that sounds like every other AI-generated LinkedIn post: emojis, "thrilled to announce", "game-changing", "grateful", a bland closing line, at least one hashtag. Do not sound original. Output only the post.`;

const SYSTEM_YOURS = `You will be shown a writing sample from one specific person. Your job is to write a new short post (60-90 words) on the given brief that reads as if that same person wrote it: same rhythm, sentence lengths, punctuation habits, vocabulary range, level of formality, and the way they open and close. No emojis unless they used them. No "thrilled", no "game-changing", no "grateful to the team" unless that is genuinely their register. Prefer specificity over slogans. Output only the post, nothing else.`;

// --- Cost guards ---------------------------------------------------------
// The widget is public (no signup) and calls a paid model. Without limits a
// single bored visitor with a script could burn real credits. These caps keep
// worst-case spend in the £2-4/day range while keeping the hook fully real.
const PER_IP_LIMIT = 3;
const PER_IP_WINDOW_HOURS = 24;
const DAILY_GLOBAL_LIMIT = 400;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Per-worker in-memory cache. Not shared across workers — that's fine; it's a
// best-effort cost saver, not a correctness guarantee.
const cache = new Map<string, { at: number; value: { generic: string; yours: string } }>();

function cacheKey(sample: string, brief: string) {
  return createHash("sha256").update(`${sample}\u0000${brief}`).digest("hex");
}

function getClientIp(): string {
  try {
    const req = getRequest();
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || "unknown";
    const cf = req.headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  } catch {
    // no request context (shouldn't happen inside a handler, but be safe)
  }
  return "unknown";
}

function hashIp(ip: string): string {
  const salt = process.env.LOVABLE_API_KEY ?? "unsalted";
  return createHash("sha256").update(`${ip}\u0000${salt}`).digest("hex");
}

type TasteResult =
  | { generic: string; yours: string; error?: undefined }
  | { error: "rate_limited_ip" | "rate_limited_global"; message: string };

export const generateVoiceTaste = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<TasteResult> => {
    const sample = data.sample.trim();
    const brief = data.brief;

    // 1. Cache lookup first — a repeat click costs us nothing.
    const key = cacheKey(sample, brief);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.value;
    }

    // 2. Rate-limit checks against the ledger.
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const ipHash = hashIp(getClientIp());
    const ipCutoff = new Date(Date.now() - PER_IP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const [{ count: ipCount }, { count: dayCount }] = await Promise.all([
      db
        .from("landing_tastes")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", ipCutoff),
      db
        .from("landing_tastes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString()),
    ]);

    if ((ipCount ?? 0) >= PER_IP_LIMIT) {
      return {
        error: "rate_limited_ip",
        message: "You've had a taste. The real interview takes five minutes — and then it keeps getting closer.",
      };
    }
    if ((dayCount ?? 0) >= DAILY_GLOBAL_LIMIT) {
      return {
        error: "rate_limited_global",
        message: "The demo is popular today. Come back in a few hours — or start your real voice profile now.",
      };
    }

    // 3. Run the two model calls in parallel. Bland side on the cheapest
    // Gemini; the "your voice" side stays on the flagship flash preview.
    const genericModel = getGatewayModel("google/gemini-2.5-flash-lite");
    const yoursModel = getGatewayModel("google/gemini-3-flash-preview");

    const [generic, yours] = await Promise.all([
      generateText({
        model: genericModel,
        system: SYSTEM_GENERIC,
        prompt: `Brief: ${brief}`,
      }),
      generateText({
        model: yoursModel,
        system: SYSTEM_YOURS,
        prompt: `Writing sample from this person (their real voice):\n---\n${sample}\n---\n\nBrief: ${brief}\n\nWrite the post in their voice.`,
      }),
    ]);

    const value = { generic: generic.text.trim(), yours: yours.text.trim() };

    // 4. Cache + log usage. Fire-and-forget the insert so a ledger hiccup
    // never blocks the response the user is waiting on.
    cache.set(key, { at: Date.now(), value });
    void db.from("landing_tastes").insert({ ip_hash: ipHash });

    return value;
  });
