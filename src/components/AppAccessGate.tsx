import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAppAccess, type AppAccessState } from "@/hooks/useAppAccess";

export type AppAccessMode = "entry" | "pricing" | "protected" | "studio" | "onboarding";

type AccessDecision =
  | { kind: "allow" }
  | { kind: "loading"; label?: string; title?: string }
  | { kind: "error"; message: string }
  | { kind: "redirect"; href: string; label?: string; title?: string };

const AppAccessContext = createContext<AppAccessState | null>(null);

export function useAppAccessContext() {
  const value = useContext(AppAccessContext);
  if (!value) throw new Error("useAppAccessContext must be used inside AppAccessGate");
  return value;
}

export function AppAccessGate({ children, mode }: { children: ReactNode; mode: AppAccessMode }) {
  const access = useAppAccess();
  const navigate = useNavigate();
  const location = useRouterState({ select: (s) => s.location });
  const decision = resolveAccessDecision(access, mode, location.href, location.pathname);

  useEffect(() => {
    if (decision.kind !== "redirect") return;
    if (decision.href === location.href) return;
    navigate({ href: decision.href, replace: true });
  }, [decision, location.href, navigate]);

  if (decision.kind === "loading" || decision.kind === "redirect") {
    return <StableLoadingScreen label={decision.label} title={decision.title} />;
  }

  if (decision.kind === "error") {
    return <AccessErrorScreen message={decision.message} />;
  }

  return <AppAccessContext.Provider value={access}>{children}</AppAccessContext.Provider>;
}

export function StableLoadingScreen({ label = "Checking your account", title = "One moment…" }) {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-8 text-center">
      <div className="fade-in">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-5">{label}</p>
        <h1 className="display text-3xl md:text-5xl">{title}</h1>
      </div>
    </main>
  );
}

function AccessErrorScreen({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-8 text-center">
      <div className="max-w-md fade-in">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-5">
          Account check paused
        </p>
        <h1 className="display text-3xl md:text-5xl">Try again in a moment.</h1>
        <p className="mt-6 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

function resolveAccessDecision(
  access: AppAccessState,
  mode: AppAccessMode,
  href: string,
  pathname: string,
): AccessDecision {
  if (access.authLoading) {
    return { kind: "loading" };
  }

  if (!access.user) {
    if (mode === "pricing") return { kind: "allow" };
    return {
      kind: "redirect",
      href: `/auth?next=${encodeURIComponent(href)}`,
      label: "Opening sign in",
      title: "One moment…",
    };
  }

  if (
    access.profileLoading ||
    access.subscriptionLoading ||
    !access.profileResolved ||
    !access.subscriptionResolved
  ) {
    return { kind: "loading" };
  }

  if (access.profileError || access.subscriptionError) {
    return {
      kind: "error",
      message: access.profileError || access.subscriptionError || "Account check failed",
    };
  }

  if (!access.hasActiveSubscription) {
    if (pathname === "/pricing") return { kind: "allow" };
    return {
      kind: "redirect",
      href: "/pricing",
      label: "Opening pricing",
      title: "One moment…",
    };
  }

  if (!access.onboardingCompleted) {
    if (pathname === "/onboarding") return { kind: "allow" };
    return {
      kind: "redirect",
      href: "/onboarding",
      label: "Opening setup",
      title: "One moment…",
    };
  }

  if (mode === "entry" || mode === "pricing") {
    return {
      kind: "redirect",
      href: "/studio",
      label: "Opening studio",
      title: "One moment…",
    };
  }

  return { kind: "allow" };
}
