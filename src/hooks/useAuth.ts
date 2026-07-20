import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let identityChangeVersion = 0;

    const applySession = (sessionUser: User | null, ready: boolean) => {
      if (cancelled) return;
      setUser(sessionUser);
      if (ready) setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        // INITIAL_SESSION fires once with the session restored from storage.
        // Treat it as ready — it is the earliest point where we know the true
        // signed-in state and downstream hooks can safely query.
        applySession(session?.user ?? null, true);
        return;
      }

      identityChangeVersion += 1;
      applySession(session?.user ?? null, true);
    });

    const initialVersion = identityChangeVersion;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (identityChangeVersion !== initialVersion) return;
        applySession(data.session?.user ?? null, true);
      })
      .catch((err) => {
        // Never let a session-read failure bubble up as an unhandled rejection —
        // that surfaces as the root error boundary right after login.
        console.warn("[useAuth] getSession failed", err);
        if (cancelled) return;
        applySession(null, true);
      });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // `ready` is the explicit "auth has settled" signal. Prefer it over
  // `!loading` at call sites that gate authenticated queries.
  return { user, loading, ready: !loading };
}
