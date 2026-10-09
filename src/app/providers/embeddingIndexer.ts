import type { LlamaContext } from "@/shared/llm";

/**
 * The non-React core of `EmbeddingProvider` (7.2), kept separate so its
 * behaviour is testable without rendering anything.
 *
 * - Loads the embedding context lazily, once, and only if the embedding
 *   model is already downloaded — it never downloads anything (that's an
 *   explicit user action in `features/manage-embedding-model`).
 * - Runs every job (single capsule or full backfill) strictly one at a
 *   time on a promise chain: a llama context must not be used for two
 *   embeddings concurrently.
 * - Never rejects. Indexing is a background convenience; a failure is
 *   reported through `onError` and must never block or fail a capsule save.
 */

export type IndexerDeps = {
  /** Current `file://` URI of the downloaded embedding model, or undefined. */
  getModelUri: () => string | undefined;
  loadContext: (modelUri: string) => Promise<LlamaContext>;
  releaseContext: (ctx: LlamaContext) => Promise<void>;
  indexOne: (ctx: LlamaContext, capsuleId: string) => Promise<boolean>;
  indexAll: (
    ctx: LlamaContext,
  ) => Promise<{ embedded: number; skipped: number; failed: number }>;
  onError: (error: unknown) => void;
};

export type EmbeddingIndexer = {
  /** Index (or re-index) one capsule. Resolves when done; never rejects. */
  enqueue: (capsuleId: string) => Promise<void>;
  /**
   * Runs a read (e.g. retrieval for a chat message) on the shared context,
   * in the same serial queue. Resolves to null — never rejects — when no
   * model is downloaded, the indexer is disposed, or the read fails.
   */
  retrieve: <T>(read: (ctx: LlamaContext) => Promise<T>) => Promise<T | null>;
  /** Index every capsule that needs it. Never rejects. */
  backfill: () => Promise<void>;
  /** Release the loaded context; the next job loads it again (after a new download or a wipe). */
  reset: () => Promise<void>;
  /** Wait for queued work, release the context, and ignore all later jobs. */
  dispose: () => Promise<void>;
};

export function createEmbeddingIndexer(deps: IndexerDeps): EmbeddingIndexer {
  // `onError` is caller-supplied; if it ever throws, the queue must still
  // stay alive — otherwise every later job would be silently skipped.
  const report = (error: unknown) => {
    try {
      deps.onError(error);
    } catch {
      // nothing left to report to
    }
  };
  let ctx: LlamaContext | null = null;
  let queue: Promise<void> = Promise.resolve();
  let disposed = false;

  async function ensureContext(): Promise<LlamaContext | null> {
    if (ctx !== null) return ctx;
    const uri = deps.getModelUri();
    if (uri === undefined) return null;
    ctx = await deps.loadContext(uri);
    return ctx;
  }

  function run(job: (loaded: LlamaContext) => Promise<unknown>): Promise<void> {
    const next = queue.then(async () => {
      if (disposed) return;
      try {
        const loaded = await ensureContext();
        if (loaded === null) return;
        await job(loaded);
      } catch (error) {
        report(error);
      }
    });
    queue = next;
    return next;
  }

  async function releaseLoaded(): Promise<void> {
    const loaded = ctx;
    ctx = null;
    if (loaded !== null) {
      try {
        await deps.releaseContext(loaded);
      } catch (error) {
        report(error);
      }
    }
  }

  return {
    retrieve: async <T>(read: (loaded: LlamaContext) => Promise<T>) => {
      let result: T | null = null;
      await run(async (loaded) => {
        result = await read(loaded);
      });
      return result;
    },
    enqueue: (capsuleId) => run((loaded) => deps.indexOne(loaded, capsuleId)),
    backfill: () => run((loaded) => deps.indexAll(loaded)),
    reset: () => {
      const next = queue.then(releaseLoaded);
      queue = next;
      return next;
    },
    dispose: async () => {
      disposed = true;
      await queue;
      await releaseLoaded();
    },
  };
}

export type IndexerLifecycle = {
  /** Creates a fresh indexer for this mount and returns it. */
  mount: () => EmbeddingIndexer;
  /** Disposes the current indexer; `get()` returns null until the next mount. */
  unmount: () => Promise<void>;
  get: () => EmbeddingIndexer | null;
};

/**
 * Mount-scoped ownership of an indexer. React re-runs effects (cleanup then
 * setup) on Fast Refresh and under StrictMode while keeping refs, so an
 * indexer created once in a ref and disposed in cleanup would be reused
 * dead after the re-mount — every later job silently dropped. Creating it
 * in `mount()` (from the effect) avoids that.
 */
export function createIndexerLifecycle(
  factory: () => EmbeddingIndexer,
): IndexerLifecycle {
  let current: EmbeddingIndexer | null = null;
  return {
    mount: () => {
      current = factory();
      return current;
    },
    unmount: async () => {
      const disposing = current;
      current = null;
      await disposing?.dispose();
    },
    get: () => current,
  };
}
