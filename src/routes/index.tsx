import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateVoiceTaste } from "@/lib/taste.functions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SIGNUP_HREF = "/auth?mode=signup&next=%2Fapp";
const SIGNUP_LABEL = "Find your voice";

export const Route = createFileRoute("/")({
  component: Index,
});

// ---------- Landing page ----------
// Voice Within: an AI that writes like one specific person,
// and that person can lend the voice to someone drafting on their behalf.

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <Hero />
      <TasteWidget />
      <LinkedInDemo />
      <TheProblem />
      <HowItWorks />
      <GrowsWithYou />
      <LendYourVoice />
      <NotJustMemory />
      <PricingStrip />
      <ClosingCTA />
      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="px-5 sm:px-8 py-5 sm:py-6 flex items-center justify-between gap-4 border-b border-border/60">
      <span className="font-serif text-lg tracking-tight shrink-0">Voice Within</span>
      <nav className="flex items-center gap-4 sm:gap-8 min-w-0">
        <a
          href="#how"
          className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          How it works
        </a>
        <a
          href="#lend"
          className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Lend your voice
        </a>
        <a
          href="#pricing"
          className="hidden sm:inline text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Pricing
        </a>
        {loading ? (
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap">
            Account
          </span>
        ) : user ? (
          <>
            <Link
              to="/app"
              className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Studio
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            search={{ next: "/onboarding" as string }}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-4xl w-full px-8 pt-24 md:pt-36 pb-16 md:pb-24 text-center fade-in">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground mb-10">
        FOR PEOPLE WHOSE WRITING IS THEIR REPUTATION
      </p>
      <h1 className="display text-4xl md:text-6xl text-balance leading-[1.05]">
        Your writing voice is too valuable to become a bottleneck{"\n\n\n"}
        <span className="text-muted-foreground">
          {"\u00A0\u00A0\n\n"}So, teach VoiceWithin how you think, then let trusted people create content that still sounds like you.
        </span>
      </h1>
      <p className="mt-10 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto whitespace-pre-line">
        We learn your individual writing voice, your taste, and also, if you want, lend it to others.{"\n\n"}
        Five minutes is enough. A short conversation, a few honest reactions
        to sentences rephrased in front of you, and by the end there is
        writing on the page that could only be yours.{"\u00A0"}{"\n\n\n"}
        A voice you keep, and, when if required, a voice you can lend to whoever writes
        in your name.
      </p>
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
        <a
          href={SIGNUP_HREF}
          className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          {SIGNUP_LABEL}
          <span aria-hidden>→</span>
        </a>
        <a
          href="#how"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          See how it works ↓
        </a>
      </div>
      <div className="mt-16">
        <HeroBeforeAfter />
      </div>
    </section>
  );
}

function HeroBeforeAfter() {
  return (
    <div className="grid gap-4 md:grid-cols-2 text-left">
      <div className="rounded-2xl border border-border bg-background p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Generic AI
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            sounds like everyone
          </span>
        </div>
        <p className="font-serif text-[15px] leading-relaxed text-muted-foreground">
          "Thrilled to share that we've hit a game-changing milestone in our
          journey. Grateful to our incredible team and partners who made this
          possible. Excited for what's next!"
        </p>
      </div>
      <div className="rounded-2xl border border-foreground bg-accent/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-[0.22em] text-foreground">
            Your voice
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-foreground">
            sounds like you
          </span>
        </div>
        <p className="font-serif text-[15px] leading-relaxed">
          "We shipped the thing. The interesting part is not that we shipped.
          It is the call, last month, in which a customer told us we had
          been solving the wrong half of the problem all along. So we
          changed it."
        </p>
      </div>
    </div>
  );
}

function TheProblem() {
  const bullets = [
    {
      t: "On LinkedIn",
      d: "Every post opens the same way. The style is so obvious now, as obvious as stock images. Your unique voice gives you credibility.",
    },
    {
      t: "In outreach",
      d: "The reader knows, before they finish the first line, that a person did not sit down and think this. They stop reading. They do not answer.",
    },
    {
      t: "In proposals",
      d: "A style guide will not save you. No slider imitates the small, particular way a mind of yours works its way through a difficulty.",
    },
  ];
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-5xl w-full px-8 py-24 md:py-32">
        <SectionEyebrow>The problem</SectionEyebrow>
        <h2 className="display text-3xl md:text-5xl mt-4 max-w-3xl">
          There is a tell in AI writing.
          <br className="hidden md:block" />{" "}
          <span className="text-muted-foreground">
            One sentence, and the reader knows, as obvious as a stock image.
          </span>
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {bullets.map((x) => (
            <div key={x.t} className="rounded-xl border border-border bg-background p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                {x.t}
              </div>
              <p className="font-serif text-lg leading-snug">{x.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 max-w-2xl text-muted-foreground leading-relaxed">
          What is offered elsewhere is either a general model in borrowed
          clothing, or the hope that, by using the same assistant for a year,
          it will gather up scraps of you by accident. Neither is how a
          voice is formed. A voice is formed by attention, and by being
          asked the right question at the right moment.
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Bring a few things you have actually written.",
      d: "An email. A post. A note to a friend that you never sent. Anything with your fingerprints on it.",
    },
    {
      n: "02",
      t: "React to a few rephrasings.",
      d: "The same sentence is set before you, rewritten several ways. You say which is yours and which is not. Two minutes, perhaps five.",
    },
    {
      n: "03",
      t: "Write in your voice, everywhere.",
      d: "In LinkedIn, in email, in a long proposal, in a short reply. The same voice, drawn from the same well.",
    },
  ];
  return (
    <section id="how" className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-5xl w-full px-8 py-24 md:py-32">
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="display text-3xl md:text-5xl mt-4 max-w-3xl">
          A short interview. Not a settings screen.
        </h2>
        <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">
          No one can describe their own writing. Yet anyone will recognise it,
          without hesitation, the moment it is placed in front of them. So we
          do not ask. We show, and you answer with a look.
        </p>
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-background p-8">
              <div className="font-serif text-2xl text-muted-foreground">{s.n}</div>
              <p className="mt-4 font-serif text-xl leading-snug">{s.t}</p>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function GrowsWithYou() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-4xl w-full px-8 py-24 md:py-32">
        <SectionEyebrow>It grows with you</SectionEyebrow>
        <h2 className="display text-3xl md:text-5xl mt-4 text-balance">
          Your voice isn't static.
          <br className="hidden md:block" />{" "}
          <span className="text-muted-foreground">
            Your profile shouldn't be either.
          </span>
        </h2>
        <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">
          A person changes. A new audience arrives, an old habit falls away,
          a phase is quietly outgrown. Voice Within notices these small
          shifts and steps in with one gentle question. Ten seconds, no
          survey, and then the work goes on.
        </p>
        <div className="mt-10 rounded-2xl border border-border bg-background p-8 max-w-xl">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
            A gentle nudge, not a chore
          </div>
          <p className="font-serif italic text-xl leading-snug">
            "Lately you have begun opening posts with a question. Is that
            still you, or shall we let it go?"
          </p>
          <div className="mt-5 flex gap-3">
            <span className="inline-flex items-center rounded-full border border-foreground px-4 py-1.5 text-xs">
              Yep, keep it
            </span>
            <span className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground">
              Not really me
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function LendYourVoice() {
  const controls = [
    {
      t: "Approval by default",
      d: "Every draft written for you is set aside and waits. Nothing moves without your hand. Autopilot is off, unless you choose otherwise.",
    },
    {
      t: "Narrow the scope",
      d: "Let one person draft your outreach, but not your LinkedIn. Or one client account, and no others. You decide the fence.",
    },
    {
      t: "Revoke instantly",
      d: "Access ends the moment you say so. Without lingering copies or shared logins.",
    },
  ];
  return (
    <section id="lend" className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-5xl w-full px-8 py-28 md:py-36">
        <SectionEyebrow>Lend your voice</SectionEyebrow>
        <h2 className="display text-3xl md:text-5xl mt-4 max-w-3xl">
          Once it sounds like you,
          <br className="hidden md:block" />{" "}
          <span className="text-muted-foreground">
            you can hand it to someone you trust.
          </span>
        </h2>
        <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">
          An assistant. An intern. A ghostwriter. A trusted collaborator.
          They draft in your voice, on your behalf, and nothing leaves the
          room until you have read it and said yes. This is a way of being
          in more places at once. It is not a way of handing over your
          judgement.
        </p>

        <div className="mt-14 grid gap-6 md:grid-cols-[1.1fr_1fr] items-start">
          <div className="rounded-2xl border border-foreground bg-background p-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
              A day in one inbox
            </div>
            <ol className="space-y-5">
              <li className="flex gap-4">
                <span className="font-serif text-muted-foreground shrink-0 w-10">09:12</span>
                <p className="font-serif text-[15px] leading-snug">
                  Your assistant drafts three LinkedIn posts for the week,
                  written in your voice.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="font-serif text-muted-foreground shrink-0 w-10">09:31</span>
                <p className="font-serif text-[15px] leading-snug">
                  They arrive in your approval queue. You read them the way
                  you would read your own writing, over coffee, in no hurry.
                </p>
              </li>
              <li className="flex gap-4">
                <span className="font-serif text-muted-foreground shrink-0 w-10">09:34</span>
                <p className="font-serif text-[15px] leading-snug">
                  Two you approve. One you send back with a note. Nothing
                  leaves in your name that was not, in the end, chosen by
                  you.
                </p>
              </li>
            </ol>
          </div>

          <div className="space-y-4">
            {controls.map((x) => (
              <div key={x.t} className="rounded-xl border border-border bg-background p-6">
                <div className="font-serif text-lg">{x.t}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NotJustMemory() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-4xl w-full px-8 py-24 md:py-32">
        <SectionEyebrow>Why not just use a general AI assistant?</SectionEyebrow>
        <h2 className="display text-3xl md:text-5xl mt-4 max-w-3xl text-balance">
          A voice isn't a side effect.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
              What general assistants do
            </div>
            <p className="font-serif text-lg leading-snug text-muted-foreground">
              They gather scattered facts about you, by accident, over months
              of ordinary use. This is useful. It is not a voice. And there
              is nothing there you could ever hand to another person.
            </p>
          </div>
          <div className="rounded-2xl border border-foreground bg-accent/20 p-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-foreground mb-3">
              What Voice Within does
            </div>
            <p className="font-serif text-lg leading-snug">
              Builds one thing, on purpose: how you write. It goes with you
              wherever you draft, and, when you allow it, into the hands of
              someone drafting on your behalf, always subject to your
              approval.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingStrip() {
  return (
    <section id="pricing" className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-4xl w-full px-8 py-24 md:py-32">
        <SectionEyebrow>Pricing</SectionEyebrow>
        <h2 className="display text-3xl md:text-5xl mt-4 max-w-3xl">
          One plan. Add a seat when you're ready to lend.
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-foreground bg-background p-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
              Individual
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-4xl">£20</span>
              <span className="text-sm text-muted-foreground">/ month</span>
              <span className="ml-2 inline-flex items-center rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground/80">
                3 days free
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Try free for 3 days. Cancel before day 3 and you won't be charged.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li>· Your voice profile, from a 5-minute interview</li>
              <li>· Unlimited drafting across your writing surfaces</li>
              <li>· Gentle drift check-ins as your voice evolves</li>
            </ul>
            <Link
              to="/auth"
              search={{ next: "/onboarding" as string }}
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
            >
              Start free trial <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-background p-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
              Delegate seat · add-on
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-4xl">+£10</span>
              <span className="text-sm text-muted-foreground">/ seat / month</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              <li>· Give one person access to draft in your voice</li>
              <li>· Everything routes through your approval queue</li>
              <li>· Revoke or narrow their scope any time</li>
            </ul>
            <p className="mt-8 text-xs text-muted-foreground">
              Add seats from settings once your voice is set up.
            </p>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Local currency at checkout. Cancel any time.
        </p>
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-3xl w-full px-8 py-32 md:py-40 text-center">
        <h2 className="display text-3xl md:text-5xl text-balance">
          Sound like you.
          <br className="hidden md:block" />{" "}
          <span className="text-muted-foreground">
            Lend that voice when you need to.
          </span>
        </h2>
        <p className="mt-8 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Five minutes to teach it the first time. Yours to keep afterwards,
          and yours to share, on your own terms, with whoever writes beside
          you.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
          <a
            href={SIGNUP_HREF}
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-7 py-4 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Start your 5-minute interview
            <span aria-hidden>→</span>
          </a>
          <a
            href="#demo"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See it in action →
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="px-8 py-10 text-xs text-muted-foreground border-t border-border flex flex-col md:flex-row items-center justify-between gap-3">
      <span className="font-serif italic">An AI that sounds like you. And only you.</span>
      <span>© {new Date().getFullYear()} Voice Within</span>
    </footer>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
      {children}
    </p>
  );
}

// ------ Live taste widget: prove the voice before the signup wall ------

const TASTE_BRIEFS = [
  "Announce that we just shipped a big new feature.",
  "Share one honest lesson from the last six months of building.",
  "Post about hiring for a role that matters.",
];

function TasteWidget() {
  const call = useServerFn(generateVoiceTaste);
  const [sample, setSample] = useState("");
  const [brief, setBrief] = useState(TASTE_BRIEFS[0]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ generic: string; yours: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const usedRef = useMemo(() => ({ n: 0 }), []);

  const canRun = sample.trim().length >= 120 && state !== "loading";

  async function run() {
    if (!canRun) return;
    if (usedRef.n >= 3) {
      setError("You've had a taste. The real interview takes five minutes.");
      setState("error");
      return;
    }
    setState("loading");
    setError(null);
    try {
      const out = await call({ data: { sample: sample.trim(), brief } });
      if ("error" in out && out.error) {
        setError(out.message);
        setState("error");
        return;
      }
      setResult({ generic: out.generic, yours: out.yours });
      usedRef.n += 1;
      setState("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went sideways.";
      setError(msg);
      setState("error");
    }
  }

  return (
    <section id="taste" className="border-t border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-5xl w-full px-6 md:px-8 py-24 md:py-32">
        <div className="text-center max-w-2xl mx-auto">
          <SectionEyebrow>Thirty seconds, no signup</SectionEyebrow>
          <h2 className="display text-3xl md:text-5xl mt-4 text-balance">
            Paste something you wrote.
            <br className="hidden md:block" />{" "}
            <span className="text-muted-foreground">
              Watch a generic AI, then watch yours.
            </span>
          </h2>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            An email, a post, a note. Anything with your fingerprints on it.
            One click and we write the same post two ways.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-[1fr_1.2fr] items-start">
          <div className="rounded-2xl border border-border bg-background p-6 md:p-8">
            <label className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Something you wrote
            </label>
            <textarea
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              placeholder="Paste at least a paragraph. The more of you is in it, the sharper the result."
              className="mt-3 w-full min-h-[220px] resize-y rounded-lg border border-border bg-background p-4 font-serif text-[15px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-foreground"
              maxLength={4000}
            />
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{sample.trim().length} / 120 minimum</span>
              <span>Not stored. Not used to train anything.</span>
            </div>

            <label className="mt-6 block text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Write about
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TASTE_BRIEFS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrief(b)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    brief === b
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b.replace(/\.$/, "")}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              className="mt-6 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {state === "loading" ? "Reading your voice…" : "Show me the difference"}
              <span aria-hidden>→</span>
            </button>
            {error && (
              <p className="mt-3 text-xs text-destructive">{error}</p>
            )}
          </div>

          <div className="grid gap-4">
            <TasteResultCard
              label="A generic AI"
              tone="muted"
              text={
                result?.generic ??
                (state === "loading"
                  ? "Writing the version you've seen a thousand times…"
                  : "The version you've seen a thousand times will appear here.")
              }
              loading={state === "loading" && !result}
            />
            <TasteResultCard
              label="Your voice, first pass"
              tone="you"
              text={
                result?.yours ??
                (state === "loading"
                  ? "Reading your rhythm, your openings, your closings…"
                  : "A first pass in your voice will appear here.")
              }
              loading={state === "loading" && !result}
            />
            {result && (
              <div className="rounded-xl border border-border bg-background p-5">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This is thirty seconds of you. The real profile, built from a
                  short interview and a few rephrasings, is sharper by an order
                  of magnitude.
                </p>
                <a
                  href={SIGNUP_HREF}
                  className="mt-4 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90"
                >
                  Build the real one <span aria-hidden>→</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TasteResultCard({
  label,
  tone,
  text,
  loading,
}: {
  label: string;
  tone: "muted" | "you";
  text: string;
  loading: boolean;
}) {
  const isYou = tone === "you";
  return (
    <div
      className={`rounded-2xl border p-6 min-h-[180px] ${
        isYou ? "border-foreground bg-accent/20" : "border-border bg-background"
      }`}
    >
      <div
        className={`text-[10px] uppercase tracking-[0.22em] mb-3 ${
          isYou ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </div>
      <p className={`font-serif text-[15px] leading-relaxed whitespace-pre-wrap ${loading ? "text-muted-foreground animate-pulse" : ""}`}>
        {text}
      </p>
    </div>
  );
}

// ------ Interactive LinkedIn demo (kept: it's the magic moment) ------

type Draft = {
  label: string;
  text: string;
  verdict: "ai" | "human" | "sharp";
  score: number;
};

const DRAFTS: Draft[] = [
  {
    label: "Generic AI",
    verdict: "ai",
    score: 94,
    text:
      "Thrilled to announce we've closed our Series A! 🚀 This game-changing milestone will unleash the next chapter of our revolutionary journey. Grateful to our incredible team and investors who believed from day one. The future is bright. #startup #funding",
  },
  {
    label: "Your voice",
    verdict: "human",
    score: 97,
    text:
      "We raised a Series A. The number matters less than what it buys us: another two years to keep obsessing over the one problem our customers keep telling us hurts most. Same team. Same question. A bit more room to answer it.",
  },
  {
    label: "Sharp",
    verdict: "sharp",
    score: 89,
    text:
      "New round closed. We're not going to post the size. We'd rather post the three customer problems it lets us finally fix this year.",
  },
];

function useTypewriter(text: string, active: boolean, speed = 14) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    setOut("");
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setOut(text);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, active, speed]);
  return out;
}

function LinkedInDemo() {
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const timings = useMemo(() => [1800, 3600, 2600, 3400], []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setStep((s) => (s + 1) % 4);
      setTick((t) => t + 1);
    }, timings[step]);
    return () => window.clearTimeout(id);
  }, [step, timings]);

  const drafting = step >= 1;
  const showPills = step >= 2;
  const chosen = step >= 3;

  return (
    <section id="demo" className="border-t border-border/60">
      <div className="mx-auto max-w-[1100px] w-full px-6 md:px-8 py-20 md:py-28">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <SectionEyebrow>See it in action</SectionEyebrow>
          <h2 className="display text-3xl md:text-5xl mt-4">
            Same brief. Three drafts.
            <br className="hidden md:block" />{" "}
            <span className="text-muted-foreground">
              Only one sounds like you.
            </span>
          </h2>
          <p className="mt-5 text-muted-foreground leading-relaxed">
            Watch what changes when the AI actually knows how you write.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-6 md:p-10 tour-glow">
          <div className="flex items-start gap-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground pt-1 w-24 shrink-0">
              Brief
            </div>
            <div className="font-serif text-lg md:text-xl leading-snug">
              "A LinkedIn post announcing our Series A."
            </div>
          </div>

          <div className="my-6 h-px bg-border" aria-hidden />

          <div className="grid gap-4 md:grid-cols-3">
            {DRAFTS.map((d, i) => (
              <DraftCard
                key={i}
                draft={d}
                active={drafting}
                showPill={showPills}
                chosen={chosen && d.verdict === "human"}
                dimmed={chosen && d.verdict !== "human"}
                tick={tick}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground max-w-md">
              {step === 0 && "Same brief. Watch what a generic AI would write today."}
              {step === 1 && "Three drafts. All grammatically fine."}
              {step === 2 && "A reader knows at once. So does a detector."}
              {step === 3 && "Voice Within picks the one that sounds like you."}
            </p>
            <div className="flex items-center gap-2" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-8 bg-foreground" : "w-2 bg-border"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DraftCard({
  draft,
  active,
  showPill,
  chosen,
  dimmed,
  tick,
}: {
  draft: Draft;
  active: boolean;
  showPill: boolean;
  chosen: boolean;
  dimmed: boolean;
  tick: number;
}) {
  const typed = useTypewriter(draft.text, active, 12);
  const keyed = `${tick}-${draft.label}`;
  const pill =
    draft.verdict === "ai"
      ? { text: `AI-detected · ${draft.score}%`, tone: "ai" as const }
      : draft.verdict === "human"
        ? { text: `Sounds human · ${draft.score}%`, tone: "human" as const }
        : { text: `Sharp · ${draft.score}%`, tone: "muted" as const };

  return (
    <div
      key={keyed}
      className={`relative rounded-xl border bg-background p-5 transition-all duration-500 ${
        chosen
          ? "border-foreground shadow-[0_0_0_1px_var(--foreground)]"
          : "border-border"
      } ${dimmed ? "opacity-40" : "opacity-100"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {draft.label}
        </div>
        <div
          className={`transition-opacity duration-500 ${showPill ? "opacity-100" : "opacity-0"}`}
        >
          <Pill tone={pill.tone}>{pill.text}</Pill>
        </div>
      </div>
      <p className="text-[13.5px] leading-relaxed font-serif min-h-[180px] whitespace-pre-wrap">
        {active ? typed : ""}
        {active && typed.length < draft.text.length && (
          <span className="inline-block w-[1px] h-4 align-[-2px] bg-foreground/70 ml-0.5 animate-pulse" />
        )}
      </p>
      {chosen && (
        <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-foreground">
          ✓ Selected by Voice Within
        </div>
      )}
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "ai" | "human" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ai"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : tone === "human"
        ? "bg-foreground/5 text-foreground border-foreground/40"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${cls}`}
    >
      {children}
    </span>
  );
}