"use client";

import { useLiveBudgetLifecycle } from "@/lib/things/live-budget";

/**
 * Mounts the live-budget lifecycle once per page that shows previews: sets the
 * simultaneous-instance cap from viewport size, and drops every slot when the
 * tab goes to the background.
 *
 * A component rather than a bare hook call because the pages using it are
 * server components.
 */
export function LiveBudgetProvider({ children }: { children: React.ReactNode }) {
  useLiveBudgetLifecycle();
  return <>{children}</>;
}
