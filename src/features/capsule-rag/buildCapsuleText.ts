import type { Capsule } from "@/entities/capsule";
import type { CapsuleType } from "@/entities/capsule-type";
import type { CapsuleField } from "@/entities/field";

/**
 * Assembles the text that represents one capsule for embedding — title,
 * its type's name (falling back gracefully if the type was deleted,
 * matching `CapsuleCard`'s own "Unknown type" convention), then every
 * field's name and value, one per line. Pure and deterministic: the same
 * inputs always produce the same string, which is what lets
 * `indexCapsule` detect "nothing actually changed" via a plain string
 * comparison against the last-embedded content.
 *
 * `relation`/`attachment` fields are skipped — neither has a
 * `CapsuleValue` to embed as text (their data lives in `entities/link`/
 * `entities/attachment`); embedding a relation field meaningfully would
 * mean pulling in the *target* capsule's own text, which is a real,
 * separate design question for later, not decided here.
 */
export function buildCapsuleText(
  capsule: Capsule,
  capsuleType: CapsuleType | null,
  fields: CapsuleField[],
  values: Record<string, string | null>,
): string {
  const lines = [capsule.title, capsuleType?.name ?? "Unknown type"];

  for (const field of fields) {
    if (field.fieldType === "relation" || field.fieldType === "attachment") {
      continue;
    }
    const value = values[field.id];
    if (!value) continue;
    lines.push(`${field.name}: ${value}`);
  }

  return lines.join("\n");
}
