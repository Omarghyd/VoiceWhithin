import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectDestination } from "@/lib/app-routing";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
    mode: s.mode === "signup" ? "signup" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Voice Within" },
      { name: "description", content: "Sign in to teach your AI who you are." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next, mode: initialMode } = Route.useSearch();
  const dest = getAuthRedirectDestination(next);

  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function navigateToDestination() {
    navigate({ href: dest, replace: true });
  }

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data.user) {
          setRedirecting(true);
          navigateToDestination();
        }
      })
      .catch((err) => {
        // Never leave this as an unhandled rejection — after login the next
        // page's boundary would otherwise see it as a route-level crash.
        console.warn("[auth] getUser failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [dest, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        setRedirecting(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: verified, error: verifyError } = await supabase.auth.getUser();
        if (verifyError || !verified.user) throw verifyError ?? new Error("Sign in did not complete.");
        navigateToDestination();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}` },
        });
        if (error) throw error;
        if (data.session) {
          setRedirecting(true);
          const { data: verified, error: verifyError } = await supabase.auth.getUser();
          if (verifyError || !verified.user) throw verifyError ?? new Error("Account creation did not complete.");
          navigateToDestination();
        } else {
          setInfo("Check your inbox to confirm your email, then sign in to continue.");
        }
      }
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-8 py-6">
        <Link to="/" className="font-serif text-lg tracking-tight">
          Voice Within
        </Link>
      </header>
      <section className="flex-1 flex items-center">
        <div className="mx-auto w-full max-w-sm px-8 py-16 fade-in">
          {redirecting ? (
            <>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">
                Account found
              </p>
              <h1 className="display text-3xl md:text-4xl mb-10">Taking you there…</h1>
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-6">
                {mode === "signin" ? "Welcome back" : "Create an account"}
              </p>
              <h1 className="display text-3xl md:text-4xl mb-10">
                {mode === "signin" ? "Sign in to your voice." : "Start teaching your AI."}
              </h1>
              <form onSubmit={onSubmit} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-lg border border-border bg-transparent p-4 text-base focus:outline-none focus:border-foreground/40"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-border bg-transparent p-4 text-base focus:outline-none focus:border-foreground/40"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                {info && <p className="text-sm text-muted-foreground">{info}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-30"
                >
                  {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === "signin"
                  ? "New here? Create an account →"
                  : "Already have an account? Sign in →"}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}