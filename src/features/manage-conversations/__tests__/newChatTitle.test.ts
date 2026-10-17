// Tests for step 10.15 — written before implementation (TDD)
//
// Found in the simulator: a chat started with a persona was titled after the
// persona ("Tester"), so several chats with the same persona all looked the
// same and the first-message title never applied. A new chat always starts
// with the default title; its first message names it (send-message).
import { readFileSync } from "fs";
import { join } from "path";

const newChat = readFileSync(
  join(__dirname, "../../../app/(app)/(tabs)/chat/new.tsx"),
  "utf8",
);

describe("New chat screen (10.15)", () => {
  it("doesn't title the conversation after its persona", () => {
    expect(newChat).not.toMatch(/title:\s*persona/);
  });
});
