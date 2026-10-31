import type { SQLiteDatabase } from "expo-sqlite";
import {
  insertCapsule,
  upsertCapsuleValue,
  type Capsule,
} from "@/entities/capsule";
import { getFieldsByCapsuleType } from "@/entities/field";
import { generateId } from "@/shared/lib";
import { parseQuickCapture } from "./quickCapture";

export { parseQuickCapture, type QuickCaptureResult } from "./quickCapture";

export type CreateCapsuleInput = {
  capsuleTypeId: string;
  title?: string;
  /** Nesting (8.5) — omit or pass null for a root-level capsule. */
  parentCapsuleId?: string | null;
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
    parentCapsuleId: input.parentCapsuleId ?? null,
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

/**
 * Quick capture (8.6, 10.43): creates a capsule of `capsuleTypeId` from one
 * line of text, filling the type's fields that a simple pattern names
 * ("Dune by Frank Herbert (1965)" → title Dune, Author, Year). See
 * `parseQuickCapture` for the patterns; unmatched text stays in the title.
 */
export function captureQuickCapsule(
  db: SQLiteDatabase,
  input: { capsuleTypeId: string; text: string },
): Capsule {
  const fields = getFieldsByCapsuleType(db, input.capsuleTypeId);
  const { title, values } = parseQuickCapture(input.text, fields);
  return createCapsule(db, {
    capsuleTypeId: input.capsuleTypeId,
    title,
    values,
  });
}
