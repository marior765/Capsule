// Tests for step 8.6 "command palette" — written before implementation (TDD)
import { filterCommands, type Command } from "../filterCommands";

const commands: Command[] = [
  { id: "capsules", label: "Capsules", path: "/capsules" },
  { id: "chat", label: "Chat", path: "/chat" },
  { id: "new-conversation", label: "New conversation", path: "/chat/new" },
  { id: "settings", label: "Settings", path: "/settings" },
];

describe("filterCommands", () => {
  it("returns every command when the query is empty", () => {
    expect(filterCommands(commands, "")).toEqual(commands);
  });

  it("returns every command when the query is whitespace-only", () => {
    expect(filterCommands(commands, "   ")).toEqual(commands);
  });

  it("matches case-insensitively", () => {
    expect(filterCommands(commands, "SETTINGS").map((c) => c.id)).toEqual([
      "settings",
    ]);
  });

  it("matches a substring anywhere in the label, not just a prefix", () => {
    expect(filterCommands(commands, "versation").map((c) => c.id)).toEqual([
      "new-conversation",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterCommands(commands, "xyz")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const original = [...commands];
    filterCommands(commands, "chat");
    expect(commands).toEqual(original);
  });

  it("trims leading/trailing whitespace from the query before matching", () => {
    expect(filterCommands(commands, "  chat  ").map((c) => c.id)).toEqual([
      "chat",
    ]);
  });
});
