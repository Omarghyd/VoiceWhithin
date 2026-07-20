import { type ReactNode } from "react";
import { AppAccessGate, type AppAccessMode } from "@/components/AppAccessGate";

export function PaywallGate({
  children,
  mode = "protected",
}: {
  children: ReactNode;
  mode?: AppAccessMode;
}) {
  return <AppAccessGate mode={mode}>{children}</AppAccessGate>;
}
