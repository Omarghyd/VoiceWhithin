import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { generateVariations, recordChoice, getMyUsage } from "@/lib/voicedna.functions";
import { loadState, saveState, updateState, type VoiceState } from "@/lib/voicedna-store";
import { PaywallGate } from "@/components/PaywallGate";
import { supabase } from "@/integrations/supabase/client";
import { saveMyVoiceProfile, listGrantsForMe } from "@/lib/lending.functions";
import { useAppAccessContext } from "@/components/AppAccessGate";
import {
  getMyVoiceCardStatus,
  publishMyVoiceCard,
  unpublishMyVoiceCard,
} from "@/lib/voice-card.functions";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [{ title: "Studio — VoiceWithin" }] }),
  component: () => (
    <PaywallGate mode="studio">
      <Studio />
    </PaywallGate>
  ),
});

type Variation = { label: string; text: string };

function Studio() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useAppAccessContext();
  const userId = access.user?.id;
  const [state, setState] = useState<VoiceState | null>(null);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [chosen, setChosen] = useState<Variation | null>(null);
  const [reason, setReason] = useState("");
  const [savedMemory, setSavedMemory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ tokensUsed: number; limit: number } | null>(null);
  const [showPortrait, setShowPortrait] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);
  const [share, setShare] = useState<{
    isPublic: boolean;
    slug: string | null;
    displayName: string;
    signaturePassage: string;
  } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const local = loadState(userId);
    const remote = access.profile;
    const next =
      local.profile || !remote
        ? local
        : {
            ...local,
            profile: {
              opening: remote.opening,
              observations: remote.observations,
              createdAt: Date.now(),
            },
            memory: remote.memory.length > 0 ? remote.memory : local.memory,
          };
    if (next !== local) saveState(next, userId);
    setState(next);
    briefRef.current?.focus();
  }, [access.profile, userId]);

  async function refreshUsage() {
    try {
      const u = await getMyUsage();
      setUsage({ tokensUsed: u.tokensUsed, limit: u.limit });
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshUsage();
  }, []);

  // Sync local profile to the server so it can be lent.
  useEffect(() => {
    const s = loadState(userId);
    if (s.profile) {
      void saveMyVoiceProfile({
        data: {
          opening: s.profile.opening,
          observations: s.profile.observations,
          memory: s.memory,
        },
      }).catch(() => {
        /* silent */
      });
    }
    void listGrantsForMe()
      .then((g) => setIncomingCount(g.filter((x) => x.status === "active").length))
      .catch(() => setIncomingCount(0));
    void getMyVoiceCardStatus()
      .then((s) =>
        setShare({
          isPublic: s.isPublic,
          slug: s.slug,
          displayName: s.displayName ?? "",
          signaturePassage: s.signaturePassage ?? "",
        }),
      )
      .catch(() => setShare(null));
  }, []);

  async function onPublishCard() {
    if (!share) return;
    const displayName = share.displayName.trim();
    if (!displayName) return;
    setShareBusy(true);
    try {
      const r = await publishMyVoiceCard({
        data: {
          displayName,
          signaturePassage: share.signaturePassage.trim(),
        },
      });
      setShare({ ...share, isPublic: true, slug: r.slug });
    } catch {
      /* silent */
    } finally {
      setShareBusy(false);
    }
  }

  async function onUnpublishCard() {
    setShareBusy(true);
    try {
      await unpublishMyVoiceCard();
      if (share) setShare({ ...share, isPublic: false });
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!share?.slug) return;
    const url = `${window.location.origin}/v/${share.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function onGenerate() {
    if (!brief.trim() || !state?.profile) return;
    setLoading(true);
    setError(null);
    setVariations([]);
    setChosen(null);
    setReason("");
    setSavedMemory(null);
    try {
      const r = await generateVariations({
        data: {
          brief,
          observations: state.profile.observations,
          memory: state.memory,
        },
      });
      setVariations(r.variations);
      refreshUsage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function onChoose(v: Variation) {
    setChosen(v);
    setTimeout(() => {
      document
        .getElementById("reason-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function onLearn() {
    if (!chosen) return;
    setLoading(true);
    try {
      const r = await recordChoice({
        data: {
          brief,
          chosen: chosen.text,
          otherOptions: variations.filter((v) => v !== chosen).map((v) => v.text),
          reason,
        },
      });
      const next = updateState((s) => ({ ...s, memory: [...s.memory, r.memory] }), userId);
      setState(next);
      setSavedMemory(r.memory);
      refreshUsage();
      // Push updated memory to the server profile.
      if (next.profile) {
        void saveMyVoiceProfile({
          data: {
            opening: next.profile.opening,
            observations: next.profile.observations,
            memory: next.memory,
          },
        }).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setLoading(false);
    }
  }

  function newDraft() {
    setBrief("");
    setVariations([]);
    setChosen(null);
    setReason("");
    setSavedMemory(null);
    setTimeout(() => briefRef.current?.focus(), 0);
  }

  if (!state || !state.profile) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-8 text-center">
        <div className="fade-in">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-5">
            Opening setup
          </p>
          <h1 className="display text-3xl md:text-5xl">One moment…</h1>
        </div>
      </main>
    );
  }

  function downloadPortrait() {
    if (!state?.profile) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            opening: state.profile.opening,
            observations: state.profile.observations,
            memory: state.memory,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voice-within-portrait.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="px-8 py-6 flex items-center justify-between">
        <Link to="/" className="font-serif text-lg tracking-tight">
          Voice Within
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/lend"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Lend your voice{incomingCount > 0 ? ` · ${incomingCount}` : ""} →
          </Link>
          <Link
            to="/onboarding"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            What I've learned
          </Link>
          {usage && (
            <span
              className="text-xs text-muted-foreground tabular-nums"
              title={`${usage.tokensUsed.toLocaleString()} / ${usage.limit.toLocaleString()} tokens this month`}
            >
              {Math.min(100, Math.round((usage.tokensUsed / usage.limit) * 100))}% used
            </span>
          )}
          <button
            onClick={async () => {
              await queryClient.cancelQueries();
              queryClient.clear();
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-8 pt-16 pb-32">
        {state.profile && (
          <section className="mb-16">
            <div className="rounded-2xl border border-border bg-secondary/30 p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Your voice, as I hear it
                </p>
                <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.18em]">
                  <button
                    onClick={() => setShareOpen((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {share?.isPublic ? "Share link" : "Share"}
                  </button>
                  <button
                    onClick={downloadPortrait}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Download
                  </button>
                  <Link
                    to="/onboarding"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Refine
                  </Link>
                </div>
              </div>
              <p className="font-serif italic text-xl leading-snug">
                {state.profile.opening}
              </p>
              {state.profile.observations.length > 0 && (
                <ul className="mt-6 space-y-2.5">
                  {state.profile.observations.slice(0, showPortrait ? undefined : 3).map((o, i) => (
                    <li key={i} className="font-serif text-[15px] leading-relaxed text-muted-foreground">
                      · {o}
                    </li>
                  ))}
                </ul>
              )}
              {state.profile.observations.length > 3 && (
                <button
                  onClick={() => setShowPortrait((v) => !v)}
                  className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                >
                  {showPortrait ? "Show less ↑" : `See ${state.profile.observations.length - 3} more ↓`}
                </button>
              )}
            </div>

            {shareOpen && share && (
              <div className="mt-4 rounded-2xl border border-border bg-background p-6 md:p-8 fade-in">
                {share.isPublic && share.slug ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                      Your voice card is public
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-sm">
                      <span className="truncate">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/v/${share.slug}`
                          : `/v/${share.slug}`}
                      </span>
                      <button
                        onClick={copyShareLink}
                        className="ml-auto text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-full border border-border hover:border-foreground"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-[10px] uppercase tracking-[0.18em]">
                      <a
                        href={`/v/${share.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        View card →
                      </a>
                      <button
                        onClick={onUnpublishCard}
                        disabled={shareBusy}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        {shareBusy ? "Working…" : "Take it down"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                      Publish your voice card
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                      A one-page portrait at a link you can share. Nothing
                      leaves that isn't already visible here.
                    </p>
                    <label className="block text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
                      Your name (as you want it shown)
                    </label>
                    <input
                      value={share.displayName}
                      onChange={(e) => setShare({ ...share, displayName: e.target.value })}
                      maxLength={60}
                      placeholder="Anna Petrova"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                    <label className="mt-4 block text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
                      A short passage in your own hand (optional)
                    </label>
                    <textarea
                      value={share.signaturePassage}
                      onChange={(e) => setShare({ ...share, signaturePassage: e.target.value })}
                      maxLength={600}
                      rows={4}
                      placeholder="Paste a paragraph you're proud of. It'll appear on the card as an example."
                      className="w-full rounded-lg border border-border bg-background p-3 font-serif text-[14px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                    <button
                      onClick={onPublishCard}
                      disabled={shareBusy || !share.displayName.trim()}
                      className="mt-5 inline-flex items-center gap-3 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-40 hover:opacity-90"
                    >
                      {shareBusy ? "Publishing…" : "Publish"} <span aria-hidden>→</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">
          What are we writing?
        </p>
        <textarea
          ref={briefRef}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onGenerate();
            }
          }}
          rows={3}
          placeholder="A LinkedIn post announcing our seed round. A cold email to a designer I admire. A short reply to a customer who's frustrated."
          className="w-full resize-none bg-transparent font-serif text-2xl md:text-3xl leading-snug placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘ Enter</span>
          <button
            onClick={onGenerate}
            disabled={loading || !brief.trim()}
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {loading && variations.length === 0 ? "Writing…" : "In my voice"}
            <span aria-hidden>→</span>
          </button>
        </div>

        {error && (
          <p className="mt-8 text-sm text-destructive fade-in">{error}</p>
        )}

        {variations.length > 0 && (
          <section className="mt-20 space-y-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Three drafts. Choose the one that sounds most like you.
            </p>
            {variations.map((v, i) => {
              const isChosen = chosen === v;
              const dimmed = chosen && !isChosen;
              return (
                <button
                  key={i}
                  onClick={() => onChoose(v)}
                  className={`w-full text-left rounded-xl border p-6 transition-all fade-in ${
                    isChosen
                      ? "border-foreground bg-accent/40"
                      : "border-border hover:border-foreground/40"
                  } ${dimmed ? "opacity-40" : ""}`}
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                    {v.label}
                  </div>
                  <p className="font-serif text-lg leading-relaxed whitespace-pre-wrap">
                    {v.text}
                  </p>
                </button>
              );
            })}
          </section>
        )}

        {chosen && !savedMemory && (
          <section id="reason-anchor" className="mt-16 fade-in">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-4">
              One question
            </p>
            <h3 className="display text-2xl md:text-3xl">
              What made this one feel more like you?
            </h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="A word. A sentence. Whatever's true."
              className="mt-6 w-full resize-none rounded-lg border border-border bg-transparent p-5 font-serif text-base leading-relaxed focus:outline-none focus:border-foreground/40 transition-colors"
            />
            <div className="mt-4 flex items-center gap-6">
              <button
                onClick={onLearn}
                disabled={loading}
                className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {loading ? "Remembering…" : "Remember this"}
              </button>
              <button
                onClick={onLearn}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>
          </section>
        )}

        {savedMemory && (
          <section className="mt-16 fade-in">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-4">
              I've learned
            </p>
            <p className="font-serif italic text-2xl leading-snug">
              {savedMemory}
            </p>
            <button
              onClick={newDraft}
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Write something else
              <span aria-hidden>→</span>
            </button>
          </section>
        )}

        {state.memory.length > 0 && !variations.length && (
          <section className="mt-24">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">
              What I've learned about your voice
            </p>
            <ul className="space-y-3">
              {state.memory.slice(-6).map((m, i) => (
                <li
                  key={i}
                  className="font-serif text-base leading-relaxed text-muted-foreground"
                >
                  · {m}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}