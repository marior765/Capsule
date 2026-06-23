import "@/shared/ui/unistyles";

import { useState, type PropsWithChildren } from "react";
import { openDb, runMigrations } from "@/shared/db";
import { modelsMigration } from "@/entities/model";
import { conversationsMigration } from "@/entities/conversation";
import { messagesMigration } from "@/entities/message";
import { LlmProvider } from "./LlmProvider";

const migrations = [modelsMigration, conversationsMigration, messagesMigration];

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
