import "@/shared/ui/unistyles";

import { useState, type PropsWithChildren } from "react";
import { configureNotificationDisplay } from "@/shared/notifications";
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

export { useLlm } from "./LlmProvider";
export { useStt } from "./SttProvider";
export { useEmbeddings } from "./EmbeddingProvider";
export { useDb } from "./useDb";
export { eraseEverything } from "./eraseEverything";
export {
  exportForSharing,
  importFile,
  type ExportKind,
  type ImportKind,
  type ImportOutcome,
} from "./importExport";
