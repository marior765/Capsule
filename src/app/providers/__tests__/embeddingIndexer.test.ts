// Tests for 7.2 (app-level embedding indexer) — written before implementation (TDD)
import type { LlamaContext } from "@/shared/llm";
import {
  createEmbeddingIndexer,
  createIndexerLifecycle,
  type IndexerDeps,
} from "../embeddingIndexer";

const fakeCtx = { id: "ctx" } as unknown as LlamaContext;

function deps(overrides: Partial<IndexerDeps> = {}): IndexerDeps {
  return {
    getModelUri: jest.fn(() => "file:///document/embedding-models/bge.gguf"),
    loadContext: jest.fn(async () => fakeCtx),
    releaseContext: jest.fn(async () => {}),
    indexOne: jest.fn(async () => true),
    indexAll: jest.fn(async () => ({ embedded: 0, skipped: 0, failed: 0 })),
    onError: jest.fn(),
    ...overrides,
  };
}

describe("createEmbeddingIndexer", () => {
  it("does nothing — and never loads a model — when no embedding model is downloaded", async () => {
    const d = deps({ getModelUri: jest.fn(() => undefined) });
    const indexer = createEmbeddingIndexer(d);
    await indexer.enqueue("c1");
    await indexer.backfill();
    expect(d.loadContext).not.toHaveBeenCalled();
    expect(d.indexOne).not.toHaveBeenCalled();
    expect(d.indexAll).not.toHaveBeenCalled();
  });

  it("loads the context once, from the model's current URI, and reuses it", async () => {
    const d = deps();
    const indexer = createEmbeddingIndexer(d);
    await Promise.all([indexer.enqueue("a"), indexer.enqueue("b")]);
    await indexer.backfill();
    expect(d.loadContext).toHaveBeenCalledTimes(1);
    expect(d.loadContext).toHaveBeenCalledWith(
      "file:///document/embedding-models/bge.gguf",
    );
    expect(d.indexOne).toHaveBeenCalledWith(fakeCtx, "a");
    expect(d.indexOne).toHaveBeenCalledWith(fakeCtx, "b");
    expect(d.indexAll).toHaveBeenCalledWith(fakeCtx);
  });

  it("runs jobs one at a time (a llama context isn't safe for concurrent calls)", async () => {
    let running = 0;
    let maxRunning = 0;
    const d = deps({
      indexOne: jest.fn(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return true;
      }),
    });
    const indexer = createEmbeddingIndexer(d);
    await Promise.all(["a", "b", "c"].map((id) => indexer.enqueue(id)));
    expect(maxRunning).toBe(1);
    expect(d.indexOne).toHaveBeenCalledTimes(3);
  });

  it("never rejects: a failing job is reported and later jobs still run", async () => {
    const d = deps({
      indexOne: jest
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue(true),
    });
    const indexer = createEmbeddingIndexer(d);
    await expect(indexer.enqueue("a")).resolves.toBeUndefined();
    await indexer.enqueue("b");
    expect(d.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(d.indexOne).toHaveBeenCalledTimes(2);
  });

  it("reports a model load failure and retries the load on the next job", async () => {
    const d = deps({
      loadContext: jest
        .fn()
        .mockRejectedValueOnce(new Error("bad model"))
        .mockResolvedValue(fakeCtx),
    });
    const indexer = createEmbeddingIndexer(d);
    await indexer.enqueue("a");
    expect(d.onError).toHaveBeenCalledTimes(1);
    expect(d.indexOne).not.toHaveBeenCalled();
    await indexer.enqueue("b");
    expect(d.indexOne).toHaveBeenCalledWith(fakeCtx, "b");
  });

  it("reset() releases the context so the next job reloads (e.g. after a new download or a wipe)", async () => {
    const d = deps();
    const indexer = createEmbeddingIndexer(d);
    await indexer.enqueue("a");
    await indexer.reset();
    expect(d.releaseContext).toHaveBeenCalledWith(fakeCtx);
    await indexer.enqueue("b");
    expect(d.loadContext).toHaveBeenCalledTimes(2);
  });

  it("dispose() lets a running job finish, then releases the context and ignores later jobs", async () => {
    let finished = false;
    const d = deps({
      indexOne: jest.fn(async () => {
        await new Promise((r) => setTimeout(r, 5));
        finished = true;
        return true;
      }),
    });
    const indexer = createEmbeddingIndexer(d);
    const job = indexer.enqueue("a");
    await new Promise((r) => setTimeout(r, 1)); // job is now running
    await indexer.dispose();
    expect(finished).toBe(true);
    expect(d.releaseContext).toHaveBeenCalledWith(fakeCtx);
    await job;
    await indexer.enqueue("b");
    expect(d.indexOne).toHaveBeenCalledTimes(1);
  });

  it("dispose() drops jobs that haven't started yet instead of loading a model on the way out", async () => {
    const d = deps();
    const indexer = createEmbeddingIndexer(d);
    const job = indexer.enqueue("a");
    await indexer.dispose();
    await job;
    expect(d.loadContext).not.toHaveBeenCalled();
  });
});

describe("createEmbeddingIndexer — error handler safety", () => {
  it("keeps the queue alive even if onError itself throws", async () => {
    const d = deps({
      indexOne: jest
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue(true),
      onError: jest.fn(() => {
        throw new Error("logger broke");
      }),
    });
    const indexer = createEmbeddingIndexer(d);
    await expect(indexer.enqueue("a")).resolves.toBeUndefined();
    await expect(indexer.enqueue("b")).resolves.toBeUndefined();
    expect(d.indexOne).toHaveBeenCalledTimes(2);
  });
});

describe("createIndexerLifecycle — mount / unmount / re-mount", () => {
  it("gives a fresh, working indexer after unmount → mount (Fast Refresh / StrictMode re-run effects but keep refs)", async () => {
    const d = deps();
    const lifecycle = createIndexerLifecycle(() => createEmbeddingIndexer(d));

    lifecycle.mount();
    await lifecycle.unmount();
    lifecycle.mount();

    await lifecycle.get()?.enqueue("after-remount");
    expect(d.indexOne).toHaveBeenCalledWith(fakeCtx, "after-remount");
  });

  it("get() is null while unmounted, so callers can't reach a disposed indexer", async () => {
    const lifecycle = createIndexerLifecycle(() =>
      createEmbeddingIndexer(deps()),
    );
    expect(lifecycle.get()).toBeNull();
    lifecycle.mount();
    expect(lifecycle.get()).not.toBeNull();
    await lifecycle.unmount();
    expect(lifecycle.get()).toBeNull();
  });

  it("unmount() disposes the indexer it created (context released)", async () => {
    const d = deps();
    const lifecycle = createIndexerLifecycle(() => createEmbeddingIndexer(d));
    lifecycle.mount();
    await lifecycle.get()?.enqueue("a");
    await lifecycle.unmount();
    expect(d.releaseContext).toHaveBeenCalledWith(fakeCtx);
  });
});
