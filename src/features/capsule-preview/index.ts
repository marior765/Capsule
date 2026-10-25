import type { SQLiteDatabase } from "expo-sqlite";
import { getValuesByCapsule, type Capsule } from "@/entities/capsule";
import {
  formatFieldValue,
  getFieldsByCapsuleType,
  type CapsuleField,
} from "@/entities/field";
import { getTagsByCapsule } from "@/entities/tag";

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

  const previews: Record<string, CapsulePreview> = {};
  for (const capsule of capsules) {
    const values = new Map(
      getValuesByCapsule(db, capsule.id).map((v) => [v.fieldId, v.value]),
    );
    const fields: CapsulePreview["fields"] = [];
    for (const field of fieldsOf(capsule.capsuleTypeId)) {
      if (fields.length >= maxFields) break;
      const value = formatFieldValue(field, values.get(field.id) ?? null);
      if (value !== null) fields.push({ name: field.name, value });
    }
    const tags = getTagsByCapsule(db, capsule.id)
      .map((tag) => tag.name)
      .sort((a, b) => a.localeCompare(b));
    previews[capsule.id] = { tags, fields };
  }
  return previews;
}
