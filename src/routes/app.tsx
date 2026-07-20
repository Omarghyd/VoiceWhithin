import { createFileRoute } from "@tanstack/react-router";
import { AppAccessGate, StableLoadingScreen } from "@/components/AppAccessGate";

export const Route = createFileRoute("/app")({
  component: AppEntry,
});

function AppEntry() {
  return (
    <AppAccessGate mode="entry">
      <StableLoadingScreen label="Opening VoiceWithin" />
    </AppAccessGate>
  );
}