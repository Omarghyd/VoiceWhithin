export type Answer = { question: string; answer: string };
export type VoiceProfile = {
  opening: string;
  observations: string[];
  createdAt: number;
};
export type VoiceState = {
  answers: Answer[];
  uploads: string;
  profile: VoiceProfile | null;
  memory: string[];
};

const KEY = "voicedna:v1";
const empty: VoiceState = { answers: [], uploads: "", profile: null, memory: [] };

function keyFor(userId?: string | null) {
  return userId ? `${KEY}:${userId}` : KEY;
}

export function loadState(userId?: string | null): VoiceState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<VoiceState>) };
  } catch {
    return empty;
  }
}

export function saveState(s: VoiceState, userId?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(userId), JSON.stringify(s));
}

export function updateState(fn: (s: VoiceState) => VoiceState, userId?: string | null): VoiceState {
  const next = fn(loadState(userId));
  saveState(next, userId);
  return next;
}

export function resetState(userId?: string | null) {
  if (typeof window !== "undefined") window.localStorage.removeItem(keyFor(userId));
}