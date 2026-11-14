import type { SQLiteDatabase } from "expo-sqlite";
import { getAllCapsuleValues, type Capsule } from "@/entities/capsule";
import {
  formatFieldValue,
  getFieldsByCapsuleType,
  type CapsuleField,
} from "@/entities/field";
import { getTagsForAllCapsules } from "@/entities/tag";

export type CapsulePreview = {
  /** Tag names, alphabetically. */
  tags: string[];
  /** The first filled-in fields, in the type's field order, formatted for reading. */
  fields: { name: string; value: string }[];
};

/**
 * What a capsule card shows beyond its title (10.24): tags and the first
 * `maxFields` fields that have something to show. Keyed by capsule id. A
 * capsule whose type is gone gets an empty preview, never an error.
 *
 * Runs on every focus of the capsules tab, on the JS thread, so the number
 * of queries is fixed (10.56): all values and all tags in one query each,
 * plus one per capsule type — never one per capsule.
 */
export function getCapsulePreviews(
  db: SQLiteDatabase,
  capsules: readonly Capsule[],
  maxFields = 3,
): Record<string, CapsulePreview> {
  const fieldsByType = new Map<string, CapsuleField[]>();
  const fieldsOf = (typeId: string): CapsuleField[] => {
    let fields = fieldsByType.get(typeId);
    if (!fields) {
      fields = [...getFieldsByCapsuleType(db, typeId)].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      fieldsByType.set(typeId, fields);
    }
    return fields;
  };

  const valuesByCapsule = new Map<string, Map<string, string | null>>();
  for (const v of getAllCapsuleValues(db)) {
    const values =
      valuesByCapsule.get(v.capsuleId) ?? new Map<string, string | null>();
    values.set(v.fieldId, v.value);
    valuesByCapsule.set(v.capsuleId, values);
  }
  const tagsByCapsule = getTagsForAllCapsules(db);

  const previews: Record<string, CapsulePreview> = {};
  for (const capsule of capsules) {
    const values =
      valuesByCapsule.get(capsule.id) ?? new Map<string, string | null>();
    const fields: CapsulePreview["fields"] = [];
    for (const field of fieldsOf(capsule.capsuleTypeId)) {
      if (fields.length >= maxFields) break;
      const value = formatFieldValue(field, values.get(field.id) ?? null);
      if (value !== null) fields.push({ name: field.name, value });
    }
    const tags = (tagsByCapsule.get(capsule.id) ?? [])
      .map((tag) => tag.name)
      .sort((a, b) => a.localeCompare(b));
    previews[capsule.id] = { tags, fields };
  }
  return previews;
}
