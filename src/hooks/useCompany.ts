import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Membership = {
  role: "owner" | "steward" | "member";
  company: {
    id: string;
    name: string;
    size: string;
    invite_code: string;
    approved_voice: { opening?: string; observations?: string[] } | null;
    pending_voice: { opening?: string; observations?: string[] } | null;
    voice_status: string;
  };
};

export function useCompany(userId: string | undefined) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setMembership(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("company_members")
      .select(
        "role, company:companies(id, name, size, invite_code, approved_voice, pending_voice, voice_status)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setMembership((data as Membership | null) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { membership, loading, reload: load };
}

export function isSteward(m: Membership | null): boolean {
  return !!m && (m.role === "owner" || m.role === "steward");
}