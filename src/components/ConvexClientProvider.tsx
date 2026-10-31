"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(
    // No browser "Changes you made may not be saved" prompt: it fired when sign-in redirected while the
    // sign-in request was still finishing. Unsent reports are kept by QuickReport's own offline queue.
    () => (convexUrl ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false }) : null),
    [convexUrl],
  );

  // Keep the starter UI usable before a Convex deployment is configured.
  // Protected operations must remain unavailable until Convex is configured.
  if (!client) return <>{children}</>;

  // Password sign-in only: never treat "?code=" as an OAuth/magic-link code. Tracking links use ?code=CP-XXXX-NN,
  // and handling it made every tracking-link visit attempt a failing sign-in that could leave auth stuck loading.
  return <ConvexAuthProvider client={client} shouldHandleCode={false}>{children}</ConvexAuthProvider>;
}
