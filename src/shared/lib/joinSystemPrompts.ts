/**
 * Joins system-prompt parts (e.g. a persona's prompt and per-turn capsule
 * grounding) with a blank line, skipping missing or blank parts. Returns
 * undefined when nothing is left, so callers send no system turn at all.
 * Shared by every completion path so they build the system turn the same way.
 */
export function joinSystemPrompts(
  ...parts: (string | null | undefined)[]
): string | undefined {
  const kept = parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  return kept.length > 0 ? kept.join("\n\n") : undefined;
}
