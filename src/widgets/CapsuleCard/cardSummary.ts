/**
 * The shape `CapsuleCard` shows beyond the title — the same as
 * `features/capsule-preview`'s `CapsulePreview`, declared here because a
 * widget doesn't import features; the caller passes it in.
 */
export type CardPreview = {
  tags: readonly string[];
  fields: readonly { name: string; value: string }[];
};

/** The list row's single line: "Book · Frank Herbert · 14 Oct 2026". */
export function listSubtitle(
  typeName: string | null,
  preview: CardPreview | undefined,
): string {
  const values = (preview?.fields ?? []).slice(0, 2).map((f) => f.value);
  return [typeName ?? "Unknown type", ...values].join(" · ");
}

/** The first `max` tags, plus how many more there are. */
export function visibleTags(
  tags: readonly string[],
  max: number,
): { shown: string[]; more: number } {
  return {
    shown: tags.slice(0, max),
    more: Math.max(0, tags.length - max),
  };
}
