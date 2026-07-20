import { useEffect, useRef, useState } from "react";
import { getMyVoiceProfile } from "@/lib/lending.functions";

export type ResolvedVoiceProfile = {
  opening: string;
  observations: string[];
  memory: string[];
};

type VoiceProfileState = {
  profile: ResolvedVoiceProfile | null;
  isLoading: boolean;
  isResolved: boolean;
  error: string | null;
};

const initialState: VoiceProfileState = {
  profile: null,
  isLoading: false,
  isResolved: false,
  error: null,
};

function normalizeProfile(
  data: Awaited<ReturnType<typeof getMyVoiceProfile>>,
): ResolvedVoiceProfile | null {
  if (!data) return null;
  return {
    opening: typeof data.opening === "string" ? data.opening : "",
    observations: Array.isArray(data.observations) ? data.observations : [],
    memory: Array.isArray(data.memory) ? data.memory : [],
  };
}


export function isVoiceProfileComplete(profile: ResolvedVoiceProfile | null): boolean {
  return Boolean(profile?.opening.trim() && profile.observations.length > 0);
}
export function useVoiceProfile(userId: string | undefined, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const requestIdRef = useRef(0);
  const [state, setState] = useState<VoiceProfileState>(initialState);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!enabled) {
      setState(initialState);
      return;
    }

    if (!userId) {
      setState({ profile: null, isLoading: false, isResolved: true, error: null });
      return;
    }

    let cancelled = false;
    setState({ profile: null, isLoading: true, isResolved: false, error: null });

    async function load() {
      try {
        const data = await getMyVoiceProfile();
        if (cancelled || requestIdRef.current !== requestId) return;
        setState({
          profile: normalizeProfile(data),
          isLoading: false,
          isResolved: true,
          error: null,
        });
      } catch (err) {
        if (cancelled || requestIdRef.current !== requestId) return;
        setState({
          profile: null,
          isLoading: false,
          isResolved: true,
          error: err instanceof Error ? err.message : "Profile check failed",
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId]);

  const onboardingCompleted = state.isResolved && isVoiceProfileComplete(state.profile);

  return {
    ...state,
    profileExists: state.isResolved && state.profile !== null,
    onboardingCompleted,
  };
}
