// Tests for 7.3 (chat toggle decision logic) — written before implementation (TDD)
import { prepareGrounding, type CapsuleContext } from "../index";

const found: CapsuleContext = {
  prompt: "CAPSULES: [1] Dentist ...",
  sources: [
    { capsuleId: "c1", title: "Dentist", score: 0.8 },
    { capsuleId: "c2", title: "Insurance", score: 0.6 },
  ],
};

describe("prepareGrounding", () => {
  it("grounds the message and names the capsules used", async () => {
    const result = await prepareGrounding({
      hasModel: true,
      retrieve: async () => found,
      query: "when is my dentist?",
      timeoutMs: 1000,
    });
    expect(result.groundingPrompt).toBe(found.prompt);
    expect(result.sources).toEqual(found.sources);
    expect(result.notice).toBe("Using 2 capsules: Dentist, Insurance");
  });

  it("uses the singular for one capsule", async () => {
    const result = await prepareGrounding({
      hasModel: true,
      retrieve: async () => ({ prompt: "x", sources: [found.sources[0]] }),
      query: "q",
      timeoutMs: 1000,
    });
    expect(result.notice).toBe("Using 1 capsule: Dentist");
  });

  it("says so plainly when nothing relevant was found, and sends ungrounded", async () => {
    const result = await prepareGrounding({
      hasModel: true,
      retrieve: async () => ({ prompt: null, sources: [] }),
      query: "q",
      timeoutMs: 1000,
    });
    expect(result.groundingPrompt).toBeUndefined();
    expect(result.notice).toBe(
      "No relevant capsules found — answered without them.",
    );
  });

  it("never calls retrieve without a downloaded model, and points to where to get it", async () => {
    const retrieve = jest.fn();
    const result = await prepareGrounding({
      hasModel: false,
      retrieve,
      query: "q",
      timeoutMs: 1000,
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(result.groundingPrompt).toBeUndefined();
    expect(result.notice).toMatch(/Models/);
  });

  it("gives up after the timeout (e.g. stuck behind start-up indexing) instead of blocking the message", async () => {
    jest.useFakeTimers();
    const pending = prepareGrounding({
      hasModel: true,
      retrieve: () => new Promise(() => {}),
      query: "q",
      timeoutMs: 3000,
    });
    jest.advanceTimersByTime(3000);
    const result = await pending;
    jest.useRealTimers();
    expect(result.groundingPrompt).toBeUndefined();
    expect(result.notice).toMatch(/unavailable/i);
  });

  it("treats a null retrieval (failure) as unavailable, not as 'nothing relevant'", async () => {
    const result = await prepareGrounding({
      hasModel: true,
      retrieve: async () => null,
      query: "q",
      timeoutMs: 1000,
    });
    expect(result.groundingPrompt).toBeUndefined();
    expect(result.notice).toMatch(/unavailable/i);
  });
});

describe("prepareGrounding — retrieve failures never block the message", () => {
  it("treats a rejecting retrieve as unavailable", async () => {
    const result = await prepareGrounding({
      hasModel: true,
      retrieve: async () => {
        throw new Error("boom");
      },
      query: "q",
      timeoutMs: 1000,
    });
    expect(result.notice).toMatch(/unavailable/i);
  });

  it("treats a synchronously throwing retrieve as unavailable instead of rejecting", async () => {
    await expect(
      prepareGrounding({
        hasModel: true,
        retrieve: () => {
          throw new Error("sync boom");
        },
        query: "q",
        timeoutMs: 1000,
      }),
    ).resolves.toMatchObject({ notice: expect.stringMatching(/unavailable/i) });
  });
});
