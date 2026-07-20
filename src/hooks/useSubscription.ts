import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export type SubscriptionRow = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function isActive(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  const endOk = !row.current_period_end || new Date(row.current_period_end) > new Date();
  if (["active", "trialing", "past_due"].includes(row.status) && endOk) return true;
  if (
    row.status === "canceled" &&
    row.current_period_end &&
    new Date(row.current_period_end) > new Date()
  ) {
    return true;
  }
  return false;
}

export function useSubscription(userId: string | undefined, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Unique per hook instance so two mounts (e.g. PaywallGate + a sibling)
  // never collide on the same channel name.
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 10));
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!enabled) {
      setSub(null);
      setLoading(false);
      setIsResolved(false);
      setError(null);
      return;
    }

    if (!userId) {
      setSub(null);
      setLoading(false);
      setIsResolved(true);
      setError(null);
      return;
    }

    let cancelled = false;
    const currentUserId = userId;
    setSub(null);
    setLoading(true);
    setIsResolved(false);
    setError(null);
    const env = (() => {
      try {
        return getStripeEnvironment();
      } catch {
        return "sandbox" as const;
      }
    })();

    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from("subscriptions")
          .select("status, price_id, current_period_end, cancel_at_period_end")
          .eq("user_id", currentUserId)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || requestIdRef.current !== requestId) return;
        setError(queryError?.message ?? null);
        setSub(queryError ? null : ((data as SubscriptionRow | null) ?? null));
      } catch (err) {
        // Any throw here (network failure, transient auth) must not become an
        // unhandled rejection — it would trip the root error boundary.
        if (cancelled || requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Subscription check failed");
        setSub(null);
      } finally {
        if (!cancelled && requestIdRef.current === requestId) {
          setLoading(false);
          setIsResolved(true);
        }
      }
    }
    void load();

    // Unique channel name per hook instance avoids duplicate-subscription
    // warnings when two components mount `useSubscription` for the same user
    // (e.g. a page and its wrapping paywall gate).
    const channelName = `sub-${currentUserId}-${instanceIdRef.current}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subscriptions",
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            void load();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn("[useSubscription] realtime subscribe failed", err);
    }

    return () => {
      cancelled = true;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [userId, enabled]);

  const hasActiveSubscription = isActive(sub);

  return {
    subscription: sub,
    isActive: hasActiveSubscription,
    hasActiveSubscription,
    loading,
    isLoading: loading,
    isResolved,
    error,
  };
}
