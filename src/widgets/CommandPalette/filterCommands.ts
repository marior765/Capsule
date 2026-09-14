import type { Href } from "expo-router";

/**
 * One static, always-available palette entry — a navigation shortcut to
 * an app area, not tied to any live data (capsule search results are a
 * separate concern, composed alongside this in `CommandPalette` itself).
 * `path` is typed as `Href` (not a bare `string`) so every entry is
 * checked against expo-router's own generated route union at compile
 * time — a typo'd path fails `tsc`, not silently 404s at runtime.
 */
export type Command = {
  id: string;
  label: string;
  path: Href;
};

/**
 * Case-insensitive substring match against each command's label — mirrors
 * `filter-sort-capsules`' own filtering shape (never mutates the input,
 * empty/whitespace-only query is a no-op pass-through) for a different
 * domain. Substring, not prefix, so "versation" still finds "New
 * conversation" — a command palette is for fast recall, not exact typing.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return commands;
  return commands.filter((command) =>
    command.label.toLowerCase().includes(trimmed),
  );
}
