import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/setup")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
  component: () => null,
});
