import "@/shared/ui/unistyles";

import { useState, type PropsWithChildren } from "react";
import { openDb, runMigrations } from "@/shared/db";
import { configureNotificationDisplay } from "@/shared/notifications";
import { migrations } from "./migrations";
import { LlmProvider } from "./LlmProvider";
import { SttProvider } from "./SttProvider";
import { EmbeddingProvider } from "./EmbeddingProvider";
import { AppLockGate } from "./AppLockGate";

export function Providers({ children }: PropsWithChildren) {
  // Reminders (8.8) also show while the app is open. Local only.
  useState(() => {
    configureNotificationDisplay();
    return null;
  });

  // AppLockGate opens (and migrates) the database — the plain one straight
  // away, or the encrypted one after unlock — before any child, including
  // LlmProvider (which reads the active model), mounts.
  return (
    <AppLockGate>
      <LlmProvider>
        <SttProvider>
          <EmbeddingProvider>{children}</EmbeddingProvider>
        </SttProvider>
      </LlmProvider>
    </AppLockGate>
  );
}

/**
 * Re-runs the same migrations `Providers` runs on boot. `openDb()`'s
 * connection is a process-wide singleton opened once; after a full wipe
 * (`features/wipe-data`'s `wipeAllData`, which calls `shared/db`'s
 * `deleteDb()`), the *next* `openDb()` call creates a brand-new, empty file
 * with no tables at all — migrations only ran once, at `Providers`' own
 * mount, not on every open. Without this, anything touching the db after a
 * wipe (audit logging, model list, the wipe confirmation flow itself if the
 * user immediately navigates elsewhere) would hit "no such table" rather
 * than a clean, freshly-provisioned database. Exported so
 * `widgets/WipeDataSettings` can restore this invariant immediately after a
 * successful wipe, in the same session, without requiring a real app
 * restart.
 */
export function remigrateDb(): void {
  runMigrations(openDb(), migrations);
}

export { useLlm } from "./LlmProvider";
export { useStt } from "./SttProvider";
export { useEmbeddings } from "./EmbeddingProvider";
export { useDb } from "./useDb";
