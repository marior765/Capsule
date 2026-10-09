import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
} from "react";
import { indexAllCapsules, indexCapsuleById } from "@/features/capsule-rag";
import {
  DEFAULT_EMBEDDING_MODEL,
  getEmbeddingModelUri,
} from "@/features/manage-embedding-model";
import { openDb } from "@/shared/db";
import { initEmbeddingContext, releaseLlm } from "@/shared/llm";
import {
  createEmbeddingIndexer,
  createIndexerLifecycle,
  type IndexerLifecycle,
} from "./embeddingIndexer";

type EmbeddingState = {
  /** Re-index one capsule in the background after it's created, edited, or restored. Fire-and-forget. */
  indexCapsule: (capsuleId: string) => void;
  /** Drop the loaded model and backfill again — after the model is downloaded or after a wipe. */
  reload: () => void;
};

const EmbeddingContext = createContext<EmbeddingState | null>(null);

/**
 * App-level owner of the embedding context for "chat with your capsules"
 * (7.2). All logic lives in `createEmbeddingIndexer`; this only wires its
 * dependencies and lifecycle. On mount it backfills the index — which
 * does nothing at all unless the embedding model was already downloaded
 * (loading a local model is fine; downloading is never automatic).
 *
 * `openDb()` is called per job, not captured once, because a full wipe
 * replaces the database connection.
 */
export function EmbeddingProvider({ children }: PropsWithChildren) {
  const lifecycle = useRef<IndexerLifecycle | null>(null);
  if (lifecycle.current === null) {
    lifecycle.current = createIndexerLifecycle(() =>
      createEmbeddingIndexer({
        getModelUri: getEmbeddingModelUri,
        loadContext: (uri) =>
          initEmbeddingContext(uri, DEFAULT_EMBEDDING_MODEL.contextLength),
        releaseContext: releaseLlm,
        indexOne: (ctx, capsuleId) =>
          indexCapsuleById(openDb(), ctx, capsuleId),
        indexAll: (ctx) => indexAllCapsules(openDb(), ctx),
        onError: (error) => {
          // Background work: never surfaced as a user-facing error, never
          // blocks a save. Logged for development only.
          if (__DEV__) console.warn("[embeddings]", error);
        },
      }),
    );
  }

  // A fresh indexer per mount (see createIndexerLifecycle for why).
  useEffect(() => {
    const owner = lifecycle.current;
    void owner?.mount().backfill();
    return () => {
      void owner?.unmount();
    };
  }, []);

  const value: EmbeddingState = {
    indexCapsule: (capsuleId) => {
      void lifecycle.current?.get()?.enqueue(capsuleId);
    },
    reload: () => {
      const indexer = lifecycle.current?.get();
      void indexer?.reset().then(() => indexer.backfill());
    },
  };

  return (
    <EmbeddingContext.Provider value={value}>
      {children}
    </EmbeddingContext.Provider>
  );
}

export function useEmbeddings(): EmbeddingState {
  const value = useContext(EmbeddingContext);
  if (value === null) {
    throw new Error("useEmbeddings must be used inside EmbeddingProvider");
  }
  return value;
}
