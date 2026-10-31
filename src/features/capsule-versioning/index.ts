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
import { formatFieldValue, getFieldsByCapsuleType } from "@/entities/field";
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
 * The capsule's values end up exactly as the version recorded them (10.33).
 * A snapshot holds only the fields that had a value row, so a field missing
 * from it was empty at that moment and is cleared — the same rule
 * `getVersionChanges` uses ("a field missing from a snapshot counts as
 * empty"), so after a restore the history shows no leftover difference.
 *
 * Decision: this includes fields added to the capsule's type AFTER the
 * version was taken. A snapshot can't tell "existed but blank" from "didn't
 * exist yet" (both are absent), and either way the field had no value at
 * that point — "restore" means "make the capsule look like it did then".
 * Nothing is lost: the safety snapshot above holds the cleared values, and
 * restoring it brings them back. Values are cleared to null (as the editor
 * clears a field), not deleted. The same goes for a leftover value of a
 * field since removed from the type: if the version didn't record it, it is
 * nulled (getVersionChanges reports it as "A removed field" otherwise).
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

  // Clear what the version didn't record (see above). Already-empty values
  // are left alone so their rows aren't rewritten for nothing.
  for (const current of getValuesByCapsule(db, version.capsuleId)) {
    if (Object.hasOwn(version.values, current.fieldId)) continue;
    if (current.value === null || current.value === "") continue;
    upsertCapsuleValue(db, { ...current, value: null, updatedAt: now });
  }

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

/** One difference between a version and the state that followed it. */
export type VersionChange = {
  /** "Title", a field's name, or "A removed field". */
  label: string;
  /** Readable values (see `formatFieldValue`); null = empty. */
  before: string | null;
  after: string | null;
};

/**
 * What each edit changed (10.28). A version is the state just BEFORE an
 * edit, so the edit is the difference between it and the next newer state —
 * the next version, or the capsule as it is now for the newest one.
 * `versions` most recent first, as `getCapsuleHistory` returns them. Keyed
 * by version id; title first, then fields in the type's order. A field
 * missing from a snapshot counts as empty.
 */
export function getVersionChanges(
  db: SQLiteDatabase,
  capsuleId: string,
  versions: readonly CapsuleVersion[],
): Record<string, VersionChange[]> {
  const capsule = getCapsuleById(db, capsuleId);
  if (!capsule) return {};
  const fields = [...getFieldsByCapsuleType(db, capsule.capsuleTypeId)].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const fieldsById = new Map(fields.map((f) => [f.id, f]));

  const current: { title: string; values: Record<string, string | null> } = {
    title: capsule.title,
    values: Object.fromEntries(
      getValuesByCapsule(db, capsuleId).map((v) => [v.fieldId, v.value]),
    ),
  };

  // Whether something changed is decided on the stored values (empty and
  // missing alike count as empty); the readable form is only for display —
  // it can hide a real edit (a long text's later lines, spacing).
  const stored = (value: string | null | undefined) =>
    value === undefined || value === null || value === "" ? null : value;
  const show = (fieldId: string, value: string | null): string | null => {
    if (value === null) return null;
    const field = fieldsById.get(fieldId);
    if (!field) return value.trim() || null;
    // The whole long text on one line, not just its first line.
    if (field.fieldType === "long_text") {
      return value.replace(/\s+/g, " ").trim() || null;
    }
    return formatFieldValue(field, value);
  };

  const result: Record<string, VersionChange[]> = {};
  let newer = current;
  for (const version of versions) {
    const changes: VersionChange[] = [];
    if (version.title !== newer.title) {
      changes.push({
        label: "Title",
        before: version.title,
        after: newer.title,
      });
    }
    const ids = new Set([
      ...Object.keys(version.values),
      ...Object.keys(newer.values),
    ]);
    const ordered = [
      ...fields.map((f) => f.id).filter((id) => ids.has(id)),
      ...[...ids].filter((id) => !fieldsById.has(id)),
    ];
    for (const fieldId of ordered) {
      const before = stored(version.values[fieldId]);
      const after = stored(newer.values[fieldId]);
      if (before !== after) {
        changes.push({
          label: fieldsById.get(fieldId)?.name ?? "A removed field",
          before: show(fieldId, before),
          after: show(fieldId, after),
        });
      }
    }
    result[version.id] = changes;
    newer = { title: version.title, values: version.values };
  }
  return result;
}
