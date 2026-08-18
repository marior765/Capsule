import type { SQLiteDatabase } from "expo-sqlite";
import {
  insertCapsule,
  upsertCapsuleValue,
  type Capsule,
} from "@/entities/capsule";
import { generateId } from "@/shared/lib";

export type CreateCapsuleInput = {
  capsuleTypeId: string;
  title?: string;
  /** fieldId -> initial value, matching CapsuleValue.value's shape. */
  values?: Record<string, string | null>;
};

/**
 * Creates a capsule and, if given, its initial field values in one call —
 * cross-entity composition lives here in the feature layer, mirroring
 * `manage-conversations`' own `createConversation` (the entities
 * themselves, `entities/capsule`'s `insertCapsule`/`upsertCapsuleValue`,
 * stay independent of each other).
 */
export function createCapsule(
  db: SQLiteDatabase,
  input: CreateCapsuleInput,
): Capsule {
  const now = Date.now();
  const capsule: Capsule = {
    id: generateId(),
    capsuleTypeId: input.capsuleTypeId,
    title: input.title ?? "Untitled",
    createdAt: now,
    updatedAt: now,
  };
  insertCapsule(db, capsule);

  for (const [fieldId, value] of Object.entries(input.values ?? {})) {
    upsertCapsuleValue(db, {
      id: generateId(),
      capsuleId: capsule.id,
      fieldId,
      value,
      createdAt: now,
      updatedAt: now,
    });
  }

  return capsule;
}
