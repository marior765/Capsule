import type { MessageSource } from "@/entities/message";

export type SourceChip = {
  capsuleId: string;
  label: string;
  /** False when the capsule no longer exists here (deleted, or the chat was imported from another device). */
  available: boolean;
};

/**
 * Turns an answer's stored sources into display chips, best match first.
 * Uses the capsule's current title when it still exists; otherwise the
 * title snapshot taken when the answer was written, marked unavailable.
 * `currentTitle` returns null for a capsule that isn't here.
 */
export function toSourceChips(
  sources: MessageSource[],
  currentTitle: (capsuleId: string) => string | null,
): SourceChip[] {
  return [...sources]
    .sort((a, b) => a.rank - b.rank)
    .map((source) => {
      const title = currentTitle(source.capsuleId);
      return {
        capsuleId: source.capsuleId,
        label: title ?? source.title,
        available: title !== null,
      };
    });
}
