// Tests for step 10.17 — written before implementation (TDD)
//
// Found in the simulator: long-pressing an assistant message did nothing —
// no way to copy a reply or ask for another one. Long-press now offers
// Copy, plus Regenerate on the latest reply.
import { readFileSync } from "fs";
import { join } from "path";
import type { Message } from "@/entities/message";
import { messageActions } from "../messageActions";

const msg = (
  id: string,
  role: Message["role"],
  parentId: string | null,
): Message => ({
  id,
  conversationId: "c",
  parentId,
  role,
  content: `${id} text`,
  tokenCount: 0,
  createdAt: 0,
});

const thread = [
  msg("u1", "user", null),
  msg("a1", "assistant", "u1"),
  msg("u2", "user", "a1"),
  msg("a2", "assistant", "u2"),
];

describe("messageActions", () => {
  it("offers Copy and Regenerate on the latest reply", () => {
    const actions = messageActions(thread[3], thread);
    expect(actions.map((a) => a.key)).toEqual(["copy", "regenerate"]);
    const regenerate = actions.find((a) => a.key === "regenerate");
    expect(regenerate?.key === "regenerate" && regenerate.from.id).toBe("u2");
  });

  it("offers only Copy on an earlier reply", () => {
    expect(messageActions(thread[1], thread).map((a) => a.key)).toEqual([
      "copy",
    ]);
  });

  it("offers nothing on the user's own messages (they have Edit)", () => {
    expect(messageActions(thread[2], thread)).toEqual([]);
  });

  it("doesn't offer Regenerate when the reply's prompt isn't in the thread", () => {
    const orphan = [msg("a9", "assistant", "missing")];
    expect(messageActions(orphan[0], orphan).map((a) => a.key)).toEqual([
      "copy",
    ]);
  });

  it("doesn't offer Regenerate when the parent isn't a user message", () => {
    const odd = [msg("a1", "assistant", null), msg("a2", "assistant", "a1")];
    expect(messageActions(odd[1], odd).map((a) => a.key)).toEqual(["copy"]);
  });
});

describe("wiring (static)", () => {
  const bubble = readFileSync(
    join(__dirname, "../../ChatBubble/ChatBubble.tsx"),
    "utf8",
  );
  const threadSrc = readFileSync(join(__dirname, "../ChatThread.tsx"), "utf8");
  const chat = readFileSync(
    join(__dirname, "../../../app/(app)/(tabs)/chat/[id].tsx"),
    "utf8",
  );

  it("ChatBubble reports a long-press, with a testID from its testIDs object", () => {
    expect(bubble).toMatch(/onLongPress=\{/);
    expect(bubble).toMatch(/testIDs\.pressables\.bubble/);
  });

  it("ChatThread forwards long-presses for replies only", () => {
    expect(threadSrc).toMatch(/onLongPressMessage/);
    expect(threadSrc).toMatch(/item\.role === "assistant"/);
  });

  // Reviewer finding: a Pressable root is one VoiceOver element, which hid the
  // Edit and code-Copy buttons inside the bubble. The root stays
  // non-accessible, and replies get a visible "⋯" options button (like Edit
  // on user messages) that screen readers — and anyone who doesn't know
  // about long-press — can reach.
  it("keeps the bubble's buttons reachable by VoiceOver", () => {
    const root = bubble.slice(
      bubble.indexOf("testIDs.pressables.bubble"),
      bubble.indexOf("testIDs.containers.root"),
    );
    expect(root).toMatch(/accessible=\{false\}/);
    expect(bubble).toMatch(/testID=\{`\$\{testIDs\.buttons\.options\}_/);
    expect(bubble).toMatch(/accessibilityLabel="Message options"/);
  });

  it("Regenerate doesn't discard an edit in progress", () => {
    expect(chat).toMatch(/if \(!regenerateFrom\) setEditing\(null\)/);
  });

  it("chat offers Copy and Regenerate and regenerates through the edit/branch path", () => {
    expect(chat).toMatch(/messageActions\(/);
    expect(chat).toMatch(/"Copy"/);
    expect(chat).toMatch(/"Regenerate"/);
    expect(chat).toMatch(/Clipboard\.setStringAsync\(message\.content\)/);
    expect(chat).toMatch(/handleSend\([^)]*\.from\.content,[^)]*\.from\)/);
  });
});
