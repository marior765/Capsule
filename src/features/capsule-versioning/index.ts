import type { SQLiteDatabase } from "expo-sqlite";
import {
  getCapsuleById,
  getValueByCapsuleAndField,
  getValuesByCapsule,
  getVersionById,
  getVersionsByCapsule,
  insertCapsuleVersion,
  updateCapsule,
  upsertCapsuleValue,
  type CapsuleVersion,
} from "@/entities/capsule";
import { generateId } from "@/shared/lib";

/**
 * Captures the capsule's current title + every field value as a new
 * `CapsuleVersion` row — a full point-in-time snapshot, not a diff.
 * Returns `null` for an unknown capsule id rather than throwing, mirroring
 * this codebase's convention for a caller passing a stale id (e.g.
 * `getCapsuleById`'s own null-not-throw shape).
 *
 * This module deliberately never calls `snapshotCapsule` on its own
 * initiative around an edit — that composition (snapshot-then-edit) is
 * `features/edit-capsule`'s call to make, kept out of this module so it
 * stays a plain "take and restore snapshots" mechanism, wireable from
 * whichever call site needs it.
 */
export function snapshotCapsule(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleVersion | null {
  const capsule = getCapsuleById(db, capsuleId);
  if (!capsule) return null;

  const values: Record<string, string | null> = {};
  for (const value of getValuesByCapsule(db, capsuleId)) {
    values[value.fieldId] = value.value;
  }

  const version: CapsuleVersion = {
    id: generateId(),
    capsuleId,
    title: capsule.title,
    values,
    createdAt: Date.now(),
  };
  insertCapsuleVersion(db, version);
  return version;
}

/** Every past snapshot of a capsule, most recent first. */
export function getCapsuleHistory(
  db: SQLiteDatabase,
  capsuleId: string,
): CapsuleVersion[] {
  return getVersionsByCapsule(db, capsuleId);
}

/**
 * Restores a capsule's title + field values from a past version. Takes a
 * safety snapshot of the capsule's CURRENT state first — so a restore is
 * itself just one more entry in the same history, not a destructive jump
 * with no way back to what was there a moment ago.
 *
 * Only sets values the version actually recorded; a field added to the
 * capsule's type after that version was taken (and so absent from
 * `version.values`) is left untouched rather than cleared, since the
 * version genuinely has no opinion about it.
 *
 * Returns `false` for an unknown version id rather than throwing.
 */
export function restoreCapsuleVersion(
  db: SQLiteDatabase,
  versionId: string,
): boolean {
  const version = getVersionById(db, versionId);
  if (!version) return false;

  snapshotCapsule(db, version.capsuleId);

  const now = Date.now();
  updateCapsule(db, version.capsuleId, {
    title: version.title,
    updatedAt: now,
  });

  for (const [fieldId, value] of Object.entries(version.values)) {
    const existing = getValueByCapsuleAndField(db, version.capsuleId, fieldId);
    upsertCapsuleValue(db, {
      id: existing?.id ?? generateId(),
      capsuleId: version.capsuleId,
      fieldId,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  return true;
}
