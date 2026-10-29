"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl],
  );

  // Keep the starter UI usable before a Convex deployment is configured.
  // Protected operations must remain unavailable until Convex is configured.
  if (!client) return <>{children}</>;

  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
