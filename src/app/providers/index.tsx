import "@/shared/ui/unistyles";

import { useState, type PropsWithChildren } from "react";
import { openDb, runMigrations } from "@/shared/db";
import { modelsMigration } from "@/entities/model";
import {
  conversationsLeafMigration,
  conversationsMigration,
  conversationsPersonaMigration,
} from "@/entities/conversation";
import { messagesMigration, messagesParentMigration } from "@/entities/message";
import { personasMigration } from "@/entities/persona";
import { auditMigration } from "@/entities/audit";
import { LlmProvider } from "./LlmProvider";
import { SttProvider } from "./SttProvider";

const migrations = [
  modelsMigration,
  conversationsMigration,
  messagesMigration,
  personasMigration,
  conversationsPersonaMigration,
  messagesParentMigration,
  conversationsLeafMigration,
  auditMigration,
];

export function Providers({ children }: PropsWithChildren) {
  // Run migrations synchronously on first render, before any child (including
  // LlmProvider, which reads the active model) mounts.
  useState(() => {
    runMigrations(openDb(), migrations);
    return null;
  });

  return (
    <LlmProvider>
      <SttProvider>{children}</SttProvider>
    </LlmProvider>
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
export { useDb } from "./useDb";
