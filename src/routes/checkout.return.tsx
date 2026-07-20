import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getStripeEnvironment } from "@/lib/stripe";
import { confirmCheckoutSession } from "@/utils/payments.functions";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Welcome — Voice Within" }] }),
  component: Return,
});

function Return() {
  const navigate = useNavigate();
  const { session_id } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const confirmCheckoutSessionFn = useServerFn(confirmCheckoutSession);
  const [status, setStatus] = useState<"checking" | "ready" | "pending" | "error">(
    session_id ? "checking" : "error",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session_id || authLoading || !user) return;
    let cancelled = false;
    let attempts = 0;

    async function confirm() {
      attempts += 1;
      setStatus("checking");
      let result: Awaited<ReturnType<typeof confirmCheckoutSessionFn>>;
      try {
        result = await confirmCheckoutSessionFn({
          data: { sessionId: session_id as string, environment: getStripeEnvironment() },
        });
      } catch (err) {
        if (cancelled) return;
        setMessage(err instanceof Error ? err.message : "Checkout confirmation failed.");
        setStatus("error");
        return;
      }
      if (cancelled) return;

      if ("error" in result) {
        setMessage(result.error);
        setStatus("error");
        return;
      }

      if (result.status === "active") {
        setStatus("ready");
        navigate({ to: "/app", replace: true });
        return;
      }

      if (attempts < 10) {
        window.setTimeout(confirm, 1500);
      } else {
        setStatus("pending");
      }
    }

    void confirm();
    return () => {
      cancelled = true;
    };
  }, [authLoading, confirmCheckoutSessionFn, navigate, session_id, user]);

  const nextPath = session_id ? `/checkout/return?session_id=${encodeURIComponent(session_id)}` : "/pricing";
  const signedOut = !authLoading && !user && Boolean(session_id);
  const title = signedOut
    ? "Sign in to finish setup."
    : status === "ready"
      ? "Opening your next step."
      : status === "pending"
        ? "Your trial is still activating."
        : status === "error"
          ? "Something didn't finish."
          : "Activating your trial.";
  const eyebrow = signedOut
    ? "Almost done"
    : status === "ready"
      ? "You're in"
      : status === "pending"
        ? "Nearly there"
        : status === "error"
          ? "Almost there"
          : "Securing your account";
  const body = signedOut
    ? "Use the same email you started with and we'll bring you straight back here."
    : status === "pending"
      ? "Payment succeeded. The access update is taking a few more seconds."
      : status === "error"
        ? message || "Head back and try again — no charge went through."
        : "Please keep this tab open for a moment.";

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center">
      <div className="mx-auto max-w-lg px-8 py-24 fade-in text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">
          {eyebrow}
        </p>
        <h1 className="display text-4xl md:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-muted-foreground">
          {body}
        </p>
        {signedOut ? (
          <Link
            to="/auth"
            search={{ next: nextPath }}
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Sign in →
          </Link>
        ) : status === "pending" ? (
          <button
            onClick={() => window.location.reload()}
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Check again →
          </button>
        ) : status === "error" ? (
          <Link
            to="/pricing"
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Back to pricing →
          </Link>
        ) : null}
      </div>
    </main>
  );
}