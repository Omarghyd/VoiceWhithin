import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { StripeEmbeddedCheckoutView } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { AppAccessGate, useAppAccessContext } from "@/components/AppAccessGate";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — VoiceWithin" },
      {
        name: "description",
        content:
          "One monthly plan. An intelligence that learns how you write and keeps getting closer.",
      },
    ],
  }),
  component: () => (
    <AppAccessGate mode="pricing">
      <Pricing />
    </AppAccessGate>
  ),
});

const PLANS = [
  {
    priceId: "creator_monthly",
    label: "Creator",
    price: "£20",
    cadence: "per month",
    note: "3 days free, then £20/month. Cancel anytime before day 3 and you won't be charged. Local currency and taxes shown at checkout.",
    highlight: true,
  },
] as const;

function Pricing() {
  const navigate = useNavigate();
  const { user, hasActiveSubscription } = useAppAccessContext();
  const [selected, setSelected] = useState<string | null>(null);

  function onChoose(priceId: string) {
    if (!user) {
      navigate({ to: "/auth", search: { next: "/app", mode: "signup" } });
      return;
    }
    if (hasActiveSubscription) {
      navigate({ to: "/app", replace: true });
      return;
    }
    setSelected(priceId);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <header className="px-8 py-6 flex items-center justify-between">
        <Link to="/" className="font-serif text-lg tracking-tight">Voice Within</Link>
        <Link
          to={user ? "/app" : "/auth"}
          search={user ? undefined : { next: "/app" as string }}
          className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
        >
          Studio
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-8 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">VoiceWithin Creator</p>
        <h1 className="display text-4xl md:text-6xl text-balance">
          One intelligence.
          <br />
          <span className="text-muted-foreground">Slowly learning how you write.</span>
        </h1>
        <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
          Every LinkedIn post, email and note draws on what it's learned about
          you so far. It only gets closer the more you use it.
        </p>

        {!hasActiveSubscription && !selected && (
          <div className="mt-12 grid gap-4">
            {PLANS.map((p) => (
              <button
                key={p.priceId}
                onClick={() => onChoose(p.priceId)}
                className={`text-left rounded-xl border p-6 transition-all hover:border-foreground/40 ${
                  p.highlight ? "border-foreground bg-accent/30" : "border-border"
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                  {p.label}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-3xl">{p.price}</span>
                  <span className="text-sm text-muted-foreground">· {p.cadence}</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-foreground/30 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                  3 days free
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{p.note}</p>
                <p className="mt-6 text-sm font-medium">Start free trial →</p>
              </button>
            ))}
            <div className="rounded-xl border border-border p-6">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Delegate seat · add-on
                </div>
                <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  +£10 / seat / month
                </span>
              </div>
              <p className="mt-4 font-serif text-lg leading-snug">
                Lend your voice to someone who drafts on your behalf.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                An assistant, intern, or collaborator. Every draft routes through
                your approval queue. Revoke any time. Add seats from settings once
                your voice is set up.
              </p>
            </div>
          </div>
        )}

        {selected && !hasActiveSubscription && (
          <div className="mt-12 fade-in">
            <button
              onClick={() => setSelected(null)}
              className="mb-4 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              ← Change plan
            </button>
            <StripeEmbeddedCheckoutView priceId={selected} />
          </div>
        )}

        <p className="mt-16 text-xs text-muted-foreground">
          Taxes handled automatically.
        </p>
      </section>
    </main>
  );
}