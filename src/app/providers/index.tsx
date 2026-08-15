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

  return <LlmProvider>{children}</LlmProvider>;
}

export { useLlm } from "./LlmProvider";
export { useDb } from "./useDb";
