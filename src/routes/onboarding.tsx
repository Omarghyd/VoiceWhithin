import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  nextOnboardingStep,
  synthesizeProfile,
  evolveModel,
} from "@/lib/voicedna.functions";
import {
  loadState,
  saveState,
  updateState,
  type Answer,
  type VoiceProfile,
} from "@/lib/voicedna-store";
import { PaywallGate } from "@/components/PaywallGate";
import { saveMyVoiceProfile } from "@/lib/lending.functions";
import { useAppAccessContext } from "@/components/AppAccessGate";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Teaching another mind — Voice Within" }] }),
  component: () => (
    <PaywallGate mode="onboarding">
      <Onboarding />
    </PaywallGate>
  ),
});

type Step =
  | { kind: "question"; prompt: string }
  | { kind: "choice"; prompt: string; options: string[] }
  | { kind: "rewrite"; prompt: string; passage: string };

type Phase = "intro" | "uploads" | "converse" | "synthesizing" | "reveal";

type Confidence = "low" | "medium" | "high";
type HStatus = "new" | "revised" | "reinforced" | "retracted";
type Hypothesis = {
  id: string;
  text: string;
  confidence: Confidence;
  status: HStatus;
  note: string | null;
};

const MIN_TURNS = 6;
const MAX_TURNS = 8;

function Onboarding() {
  const navigate = useNavigate();
  const access = useAppAccessContext();
  const userId = access.user?.id;
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [uploads, setUploads] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [metaNote, setMetaNote] = useState<string | null>(null);
  const [modelThinking, setModelThinking] = useState(false);
  const [revisionPulse, setRevisionPulse] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step, phase]);

  async function beginConversation(initialUploads: string) {
    setUploads(initialUploads);
    setPhase("converse");
    await fetchNext([], initialUploads);
  }

  async function fetchNext(current: Answer[], up: string) {
    setLoading(true);
    setError(null);
    try {
      const s = await nextOnboardingStep({ data: { answers: current, uploads: up } });
      setStep(s as Step);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went quiet. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function evolve(current: Answer[], up: string, prior: Hypothesis[]) {
    setModelThinking(true);
    try {
      const res = await evolveModel({
        data: {
          answers: current,
          uploads: up,
          priorHypotheses: prior.map((h) => ({
            id: h.id,
            text: h.text,
            confidence: h.confidence,
            status: h.status,
            note: h.note,
          })),
        },
      });
      const normalized: Hypothesis[] = (res.hypotheses ?? []).map((h) => ({
        id: h.id,
        text: h.text,
        confidence: (["low", "medium", "high"].includes(h.confidence)
          ? h.confidence
          : "medium") as Confidence,
        status: (["new", "revised", "reinforced", "retracted"].includes(h.status)
          ? h.status
          : "new") as HStatus,
        note: h.note ?? null,
      }));
      setHypotheses(normalized);
      setMetaNote(res.metaNote ?? null);
      setRevisionPulse((n) => n + 1);
    } catch {
      // silent — the model just doesn't shift this turn
    } finally {
      setModelThinking(false);
    }
  }

  async function submitAnswer(answerText: string) {
    if (!step || !answerText.trim()) return;
    const promptLabel =
      step.kind === "choice"
        ? `${step.prompt} (chose: ${answerText})`
        : step.kind === "rewrite"
          ? `${step.prompt} — original: "${step.passage}"`
          : step.prompt;
    const next: Answer[] = [...answers, { question: promptLabel, answer: answerText }];
    setAnswers(next);
    // Evolve the model in parallel with fetching the next step.
    void evolve(next, uploads, hypotheses);
    if (next.length >= MAX_TURNS || (next.length >= MIN_TURNS && Math.random() < 0.5)) {
      await synthesize(next);
    } else {
      await fetchNext(next, uploads);
    }
  }

  async function synthesize(finalAnswers: Answer[]) {
    setPhase("synthesizing");
    try {
      const p = await synthesizeProfile({
        data: { answers: finalAnswers, uploads },
      });
      const built: VoiceProfile = {
        opening: p.opening,
        observations: p.observations,
        createdAt: Date.now(),
      };
      const next = updateState(
        (s) => ({
          ...s,
          answers: finalAnswers,
          uploads,
          profile: built,
          memory: s.memory,
        }),
        userId,
      );
      // Persist server-side so the voice can be lent.
      void saveMyVoiceProfile({
        data: {
          opening: built.opening,
          observations: built.observations,
          memory: next.memory,
        },
      }).catch(() => {});
      setProfile(built);
      setPhase("reveal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't gather that yet.");
      setPhase("converse");
    }
  }

  // Resume if already onboarded
  useEffect(() => {
    const s = loadState(userId);
    if (s.profile) {
      setProfile(s.profile);
      setPhase("reveal");
      return;
    }
    if (access.profile) {
      const restored: VoiceProfile = {
        opening: access.profile.opening,
        observations: access.profile.observations,
        createdAt: Date.now(),
      };
      saveState({ ...s, profile: restored, memory: access.profile.memory }, userId);
      setProfile(restored);
      setPhase("reveal");
    }
  }, [access.profile, userId]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="px-8 py-6 flex items-center justify-between">
        <Link to="/" className="font-serif text-lg tracking-tight">
          Voice Within
        </Link>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Teaching another mind
        </span>
      </header>

      {phase === "intro" && (
        <div className="mx-auto max-w-2xl px-8 pt-16 pb-32">
          <IntroPanel onBegin={() => setPhase("uploads")} />
        </div>
      )}

      {phase === "uploads" && (
        <div className="mx-auto max-w-2xl px-8 pt-16 pb-32">
          <UploadsPanel
            onSkip={() => beginConversation("")}
            onContinue={(text) => beginConversation(text)}
          />
        </div>
      )}

      {phase === "converse" && (
        <div className="mx-auto max-w-6xl px-8 pt-10 pb-32 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 lg:gap-16">
          <div className="fade-in min-w-0">
            <Progress step={answers.length} min={MIN_TURNS} max={MAX_TURNS} />
            {loading || !step ? (
              <Thinking />
            ) : (
              <StepView
                step={step}
                input={input}
                setInput={setInput}
                onSubmit={submitAnswer}
                inputRef={inputRef}
              />
            )}
            {error && (
              <p className="mt-6 text-sm text-destructive fade-in">{error}</p>
            )}
          </div>
          <aside className="lg:sticky lg:top-10 lg:self-start">
            <ModelPanel
              hypotheses={hypotheses}
              metaNote={metaNote}
              thinking={modelThinking}
              pulseKey={revisionPulse}
              turnsSoFar={answers.length}
            />
          </aside>
        </div>
      )}

      {phase === "synthesizing" && (
        <div className="mx-auto max-w-2xl px-8 pt-16 pb-32">
          <Synthesizing />
        </div>
      )}

      {phase === "reveal" && profile && (
        <div className="mx-auto max-w-2xl px-8 pt-16 pb-32">
          <RevealPanel
            profile={profile}
            onContinue={() => navigate({ to: "/studio" })}
          />
        </div>
      )}
    </main>
  );
}

function IntroPanel({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="fade-in">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-8">
        Before we begin
      </p>
      <h1 className="display text-4xl md:text-5xl">
        You're about to teach another mind who you are.
      </h1>
      <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
        I'll form hypotheses about how you think. As you answer, you'll see me
        change my mind, notice patterns, revise what I thought I knew. This
        isn't a form. It's the other side of a mind slowly understanding you.
      </p>
      <button
        onClick={onBegin}
        className="mt-12 inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 text-sm font-medium text-background hover:opacity-90 transition-opacity"
      >
        Begin
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}

function UploadsPanel({
  onSkip,
  onContinue,
}: {
  onSkip: () => void;
  onContinue: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="fade-in">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-8">
        Optional
      </p>
      <h2 className="display text-3xl md:text-4xl">
        Paste anything you've written that sounds like you.
      </h2>
      <p className="mt-6 text-muted-foreground leading-relaxed">
        A LinkedIn post. An email you're proud of. A paragraph from your site.
        Skip this if you'd rather I learn only from what you tell me.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Paste here…"
        className="mt-8 w-full resize-none rounded-lg border border-border bg-transparent p-5 font-serif text-base leading-relaxed focus:outline-none focus:border-foreground/40 transition-colors"
      />
      <div className="mt-8 flex items-center gap-6">
        <button
          onClick={() => onContinue(text)}
          disabled={!text.trim()}
          className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          Continue
          <span aria-hidden>→</span>
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function Progress({ step, min, max }: { step: number; min: number; max: number }) {
  const total = max;
  return (
    <div className="mb-16 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-px flex-1 transition-colors duration-500 ${
            i < step ? "bg-foreground" : "bg-border"
          }`}
        />
      ))}
      <span className="ml-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
        {String(Math.min(step + 1, total)).padStart(2, "0")} / {String(min).padStart(2, "0")}
      </span>
    </div>
  );
}

function StepView({
  step,
  input,
  setInput,
  onSubmit,
  inputRef,
}: {
  step: Step;
  input: string;
  setInput: (s: string) => void;
  onSubmit: (s: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="fade-in">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">
        {step.kind === "choice"
          ? "Which feels most like you?"
          : step.kind === "rewrite"
            ? "Rewrite this in your voice"
            : "A question"}
      </p>
      {step.kind === "rewrite" ? (
        <p className="text-lg md:text-xl text-foreground/80 leading-relaxed text-balance">
          {step.prompt}
        </p>
      ) : (
        <h2 className="display text-3xl md:text-4xl text-balance">{step.prompt}</h2>
      )}

      {step.kind === "choice" && (
        <div className="mt-10 space-y-3">
          {step.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSubmit(opt)}
              className="w-full text-left rounded-lg border border-border p-5 font-serif text-base leading-relaxed hover:border-foreground/50 hover:bg-accent/30 transition-all"
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => onSubmit("Neither feels like me.")}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            Neither
          </button>
        </div>
      )}

      {step.kind === "rewrite" && (
        <>
          <div className="mt-10">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Original
            </p>
            <blockquote className="border-l-2 border-border pl-5 font-serif italic text-muted-foreground leading-relaxed">
              {step.passage}
            </blockquote>
          </div>
          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Your version
            </p>
            <FreeInput
              value={input}
              onChange={setInput}
              onSubmit={() => onSubmit(input)}
              placeholder="Rewrite the passage above in the way you'd naturally say it…"
              inputRef={inputRef}
            />
          </div>
        </>
      )}

      {step.kind === "question" && (
        <FreeInput
          value={input}
          onChange={setInput}
          onSubmit={() => onSubmit(input)}
          placeholder="In your own words…"
          inputRef={inputRef}
        />
      )}
    </div>
  );
}

function FreeInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  placeholder: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="mt-8">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={5}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-border bg-transparent p-5 font-serif text-lg leading-relaxed focus:outline-none focus:border-foreground/40 transition-colors"
      />
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          ⌘ Enter to continue
        </span>
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          Continue
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="fade-in py-8">
      <p className="font-serif italic text-muted-foreground text-lg">
        Listening<span className="dots" />
      </p>
      <style>{`.dots::after{content:'';display:inline-block;width:1.2em;text-align:left;animation:d 1.4s steps(4,end) infinite}@keyframes d{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}`}</style>
    </div>
  );
}

function ModelPanel({
  hypotheses,
  metaNote,
  thinking,
  pulseKey,
  turnsSoFar,
}: {
  hypotheses: Hypothesis[];
  metaNote: string | null;
  thinking: boolean;
  pulseKey: number;
  turnsSoFar: number;
}) {
  const confDot = (c: Confidence) =>
    c === "high"
      ? "bg-foreground"
      : c === "medium"
        ? "bg-foreground/60"
        : "bg-foreground/25";
  const statusLabel = (s: HStatus) =>
    s === "new"
      ? "new hypothesis"
      : s === "revised"
        ? "revised"
        : s === "reinforced"
          ? "more confident"
          : "let go of";
  const statusTone = (s: HStatus) =>
    s === "retracted"
      ? "text-muted-foreground line-through decoration-foreground/30"
      : "text-foreground/90";
  return (
    <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          My model of you
        </p>
        <span
          className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${
            thinking ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              thinking ? "bg-foreground animate-pulse" : "bg-foreground/30"
            }`}
          />
          {thinking ? "revising" : "settled"}
        </span>
      </div>

      {metaNote && (
        <p
          key={`meta-${pulseKey}`}
          className="fade-in mt-5 font-serif italic text-foreground/80 leading-snug"
        >
          {metaNote}
        </p>
      )}

      <div className="mt-6">
        {hypotheses.length === 0 ? (
          <p className="font-serif italic text-muted-foreground text-sm leading-relaxed">
            {turnsSoFar === 0
              ? "I haven't met you yet. Say something and I'll start forming hypotheses."
              : "Still listening. Nothing worth claiming yet."}
          </p>
        ) : (
          <ul className="space-y-4">
            {hypotheses.map((h, i) => (
              <li
                key={h.id}
                className="fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${confDot(
                      h.confidence,
                    )}`}
                    title={`confidence: ${h.confidence}`}
                  />
                  <div className="min-w-0">
                    <p className={`font-serif text-[15px] leading-snug ${statusTone(h.status)}`}>
                      {h.text}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {statusLabel(h.status)}
                    </p>
                    {h.note && (
                      <p className="mt-1 font-serif italic text-xs text-muted-foreground leading-snug">
                        {h.note}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 pt-4 border-t border-border/60 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Every answer changes something here.
      </p>
    </div>
  );
}

function Synthesizing() {
  return (
    <div className="fade-in py-24 text-center">
      <p className="font-serif italic text-2xl text-muted-foreground">
        Gathering what I've learned<span className="dots" />
      </p>
      <style>{`.dots::after{content:'';display:inline-block;width:1.5em;text-align:left;animation:d 1.6s steps(4,end) infinite}@keyframes d{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}`}</style>
    </div>
  );
}

function RevealPanel({
  profile,
  onContinue,
}: {
  profile: VoiceProfile;
  onContinue: () => void;
}) {
  return (
    <div className="fade-in">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-10">
        What I've learned
      </p>
      <h1 className="display text-4xl md:text-5xl text-balance">
        {profile.opening}
      </h1>
      <ul className="mt-14 space-y-5">
        {profile.observations.map((o, i) => (
          <li
            key={i}
            className="font-serif text-xl leading-relaxed text-foreground/90 fade-in"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            {o}
          </li>
        ))}
      </ul>
      <div className="mt-16 flex items-center gap-6">
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Write something together
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}