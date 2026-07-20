import { createFileRoute } from "@tanstack/react-router";
import { AppAccessGate, StableLoadingScreen } from "@/components/AppAccessGate";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VoiceWithin" }] }),
  component: DashboardEntry,
});

function DashboardEntry() {
  return (
    <AppAccessGate mode="entry">
      <StableLoadingScreen label="Opening dashboard" />
    </AppAccessGate>
  );
}