import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useVoiceProfile } from "@/hooks/useVoiceProfile";

export function useAppAccess() {
  const { user, loading: rawAuthLoading, ready: authReady } = useAuth();
  const authLoading = rawAuthLoading || !authReady;
  const shouldLoadUserData = authReady && Boolean(user);
  const profileState = useVoiceProfile(user?.id, { enabled: shouldLoadUserData });
  const subscriptionState = useSubscription(user?.id, { enabled: shouldLoadUserData });

  return {
    authLoading,
    authReady,
    user,
    profileLoading: shouldLoadUserData && profileState.isLoading,
    profileResolved: shouldLoadUserData ? profileState.isResolved : false,
    profile: profileState.profile,
    profileExists: profileState.profileExists,
    profileError: profileState.error,
    subscriptionLoading: shouldLoadUserData && subscriptionState.isLoading,
    subscriptionResolved: shouldLoadUserData ? subscriptionState.isResolved : false,
    subscription: subscriptionState.subscription,
    hasActiveSubscription: subscriptionState.hasActiveSubscription,
    subscriptionError: subscriptionState.error,
    onboardingCompleted: profileState.onboardingCompleted,
  };
}

export type AppAccessState = ReturnType<typeof useAppAccess>;
