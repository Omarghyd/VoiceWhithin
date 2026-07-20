import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PaywallGate } from "@/components/PaywallGate";
import { supabase } from "@/integrations/supabase/client";
import {
  claimGrantsForMyEmail,
  createGrant,
  decideDraft,
  draftAndSubmitForOwner,
  listApprovalQueue,
  listGrantsForMe,
  listMyGrantsAsOwner,
  listMySubmittedDrafts,
  revokeGrant,
} from "@/lib/lending.functions";

export const Route = createFileRoute("/lend")({
  head: () => ({ meta: [{ title: "Lend your voice — Voice Within" }] }),
  component: () => (
    <PaywallGate>
      <LendPage />
    </PaywallGate>
  ),
});

type Grant = Awaited<ReturnType<typeof listMyGrantsAsOwner>>[number];
type IncomingGrant = Awaited<ReturnType<typeof listGrantsForMe>>[number];
type Draft = Awaited<ReturnType<typeof listApprovalQueue>>[number];

const SCOPES: { value: Grant["scope"]; label: string }[] = [
  { value: "all", label: "All surfaces" },
  { value: "linkedin", label: "LinkedIn only" },
  { value: "email", label: "Email only" },
  { value: "longform", label: "Long-form only" },
];
const AUTONOMY: { value: Grant["autonomy"]; label: string; hint: string }[] = [
  { value: "always_approve", label: "Always approve", hint: "Nothing leaves in your name until you say so." },
  { value: "auto_short_replies", label: "Auto-approve short replies", hint: "Replies under 280 characters send automatically. Everything else waits." },
  { value: "off", label: "No lending yet", hint: "Save the grant, keep it dormant." },
];

function LendPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [incoming, setIncoming] = useState<IncomingGrant[]>([]);
  const [queue, setQueue] = useState<Draft[]>([]);
  const [submitted, setSubmitted] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<Grant["scope"]>("all");
  const [autonomy, setAutonomy] = useState<Grant["autonomy"]>("always_approve");

  const reload = useCallback(async () => {
    try {
      await claimGrantsForMyEmail();
      const [g, i, q, s] = await Promise.all([
        listMyGrantsAsOwner(),
        listGrantsForMe(),
        listApprovalQueue(),
        listMySubmittedDrafts(),
      ]);
      setGrants(g);
      setIncoming(i);
      setQueue(q);
      setSubmitted(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createGrant({
        data: {
          collaborator_email: email.trim().toLowerCase(),
          relationship_label: label.trim(),
          scope,
          autonomy,
        },
      });
      setEmail("");
      setLabel("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send invite.");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(grantId: string) {
    await revokeGrant({ data: { grantId } });
    void reload();
  }

  async function onDecide(
    draftId: string,
    decision: "approved" | "rejected" | "changes_requested",
    note = "",
  ) {
    await decideDraft({ data: { draftId, decision, note } });
    void reload();
  }

  const pending = queue.filter((d) => d.status === "pending");
  const decided = queue.filter((d) => d.status !== "pending");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="px-8 py-6 flex items-center justify-between border-b border-border/60">
        <Link to="/" className="font-serif text-lg tracking-tight">
          Voice Within
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/studio"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Studio
          </Link>
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

      <div className="mx-auto max-w-5xl px-8 pt-16 pb-24 fade-in">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-3">
          Lend your voice
        </p>
        <h1 className="display text-3xl md:text-5xl text-balance max-w-3xl">
          Once it sounds like you, you can hand it to someone you trust.
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">
          Nothing leaves in your name that was not, in the end, chosen by you.
        </p>

        {error && (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-16 grid gap-16 lg:grid-cols-[1.1fr_1fr]">
          {/* Approval queue */}
          <section>
            <SectionHead>Approval queue</SectionHead>
            {pending.length === 0 ? (
              <EmptyState line="Nothing leaves in your name.">
                When someone drafts on your behalf, their work waits here.
              </EmptyState>
            ) : (
              <ul className="space-y-4">
                {pending.map((d) => (
                  <DraftCard key={d.id} draft={d} onDecide={onDecide} />
                ))}
              </ul>
            )}

            {decided.length > 0 && (
              <section className="mt-12">
                <SectionHead>History</SectionHead>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {decided.slice(0, 8).map((d) => (
                    <li key={d.id} className="border-l-2 border-border pl-4">
                      <span className="font-medium text-foreground capitalize">
                        {d.status.replace("_", " ")}
                      </span>
                      {" · "}
                      {new Date(d.decided_at ?? d.created_at).toLocaleDateString()}
                      {" — "}
                      {d.brief.slice(0, 80)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>

          {/* Collaborators + invite */}
          <section>
            <SectionHead>People writing beside you</SectionHead>
            {grants.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-6">
                No one yet.
              </p>
            ) : (
              <ul className="space-y-3 mb-8">
                {grants.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-xl border border-border bg-background p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-serif text-lg leading-snug">
                          {g.relationship_label || g.collaborator_email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {g.collaborator_email} · {scopeLabel(g.scope)} ·{" "}
                          {autonomyLabel(g.autonomy)}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
                          {g.status === "active"
                            ? "Active"
                            : g.status === "pending"
                              ? "Waiting for them to sign in"
                              : "Revoked"}
                        </p>
                      </div>
                      {g.status !== "revoked" && (
                        <button
                          onClick={() => onRevoke(g.id)}
                          className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-destructive"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <SectionHead>Invite one person</SectionHead>
            <form
              onSubmit={onInvite}
              className="rounded-xl border border-border bg-background p-5 space-y-4"
            >
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Their email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="anna@example.com"
                  className="mt-2 w-full bg-transparent border-b border-border pb-2 focus:outline-none focus:border-foreground/40"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Relationship (optional)
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Anna, my EA"
                  className="mt-2 w-full bg-transparent border-b border-border pb-2 focus:outline-none focus:border-foreground/40"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  What they can draft
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SCOPES.map((s) => (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => setScope(s.value)}
                      className={`text-left rounded-lg border p-3 text-sm transition-colors ${
                        scope === s.value
                          ? "border-foreground bg-accent/30"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Autonomy
                </label>
                <div className="mt-2 space-y-2">
                  {AUTONOMY.map((a) => (
                    <button
                      type="button"
                      key={a.value}
                      onClick={() => setAutonomy(a.value)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        autonomy === a.value
                          ? "border-foreground bg-accent/30"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      <div className="text-sm font-medium">{a.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a.hint}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-30"
              >
                {busy ? "Sending…" : "Send invite"} <span aria-hidden>→</span>
              </button>
              <p className="text-xs text-muted-foreground">
                They activate the grant by signing in with the email above.
                Access ends the moment you click Revoke.
              </p>
            </form>
          </section>
        </div>

        {/* Incoming grants — I'm drafting for someone */}
        {incoming.filter((g) => g.status === "active").length > 0 && (
          <section className="mt-24">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-3">
              You're drafting for
            </p>
            <h2 className="display text-2xl md:text-3xl mb-8">
              Voices lent to you.
            </h2>
            <div className="space-y-6">
              {incoming
                .filter((g) => g.status === "active")
                .map((g) => (
                  <DraftForOwnerCard
                    key={g.id}
                    grant={g}
                    onSubmitted={reload}
                  />
                ))}
            </div>
          </section>
        )}

        {/* Collaborator's own submission history */}
        {submitted.length > 0 && (
          <section className="mt-16">
            <SectionHead>Your submissions</SectionHead>
            <ul className="space-y-3 text-sm">
              {submitted.slice(0, 8).map((d) => (
                <li
                  key={d.id}
                  className="border-l-2 border-border pl-4 text-muted-foreground"
                >
                  <span className="font-medium text-foreground capitalize">
                    {d.status.replace("_", " ")}
                  </span>
                  {" · "}
                  {new Date(d.created_at).toLocaleDateString()} —{" "}
                  {d.brief.slice(0, 80)}
                  {d.owner_note && (
                    <p className="mt-1 italic font-serif">
                      Note: {d.owner_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function EmptyState({
  line,
  children,
}: {
  line: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8">
      <p className="font-serif italic text-lg">{line}</p>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function DraftCard({
  draft,
  onDecide,
}: {
  draft: Draft;
  onDecide: (id: string, decision: "approved" | "rejected" | "changes_requested", note?: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <li className="rounded-xl border border-foreground bg-background p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
        Brief · {new Date(draft.created_at).toLocaleString()}
      </p>
      <p className="text-sm text-muted-foreground italic">{draft.brief}</p>
      <p className="mt-5 font-serif text-base leading-relaxed whitespace-pre-wrap">
        {draft.draft_text}
      </p>
      {showNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="A note for them…"
          className="mt-4 w-full resize-none rounded-lg border border-border bg-transparent p-3 text-sm focus:outline-none focus:border-foreground/40"
        />
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(draft.draft_text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            onDecide(draft.id, "approved");
          }}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-xs uppercase tracking-[0.18em] text-background hover:opacity-90"
        >
          {copied ? "Copied · Approved" : "Approve · Copy"}
        </button>
        <button
          onClick={() => {
            if (!showNote) {
              setShowNote(true);
              return;
            }
            onDecide(draft.id, "changes_requested", note);
          }}
          className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-[0.18em] hover:border-foreground"
        >
          {showNote ? "Send back" : "Send back with a note"}
        </button>
        <button
          onClick={() => onDecide(draft.id, "rejected")}
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-destructive"
        >
          Reject
        </button>
      </div>
    </li>
  );
}

function DraftForOwnerCard({
  grant,
  onSubmitted,
}: {
  grant: IncomingGrant;
  onSubmitted: () => void;
}) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!brief.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await draftAndSubmitForOwner({
        data: { grantId: grant.id, brief },
      });
      setPreview(r.draft);
      setBrief("");
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
        Drafting for {grant.relationship_label || "someone who trusts you"}
      </p>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={3}
        placeholder="What are we writing for them? A LinkedIn post about last week's launch. An email to a customer who churned."
        className="w-full resize-none bg-transparent font-serif text-lg leading-snug placeholder:text-muted-foreground/60 focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          In their voice → their approval queue.
        </span>
        <button
          onClick={onSubmit}
          disabled={busy || !brief.trim()}
          className="rounded-full bg-foreground px-5 py-2 text-xs uppercase tracking-[0.18em] text-background hover:opacity-90 disabled:opacity-30"
        >
          {busy ? "Writing…" : "Draft & send for approval"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {preview && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Sent for approval
          </p>
          <p className="font-serif text-base leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {preview}
          </p>
        </div>
      )}
    </div>
  );
}

function scopeLabel(v: string) {
  return SCOPES.find((s) => s.value === v)?.label ?? v;
}
function autonomyLabel(v: string) {
  return AUTONOMY.find((a) => a.value === v)?.label ?? v;
}