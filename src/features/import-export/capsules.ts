import type { SQLiteDatabase } from "expo-sqlite";
import {
  getCapsuleTypeById,
  getAllCapsuleTypes,
  insertCapsuleType,
  type CapsuleType,
} from "@/entities/capsule-type";
import {
  getFieldsByCapsuleType,
  insertCapsuleField,
  type CapsuleField,
} from "@/entities/field";
import {
  getAllCapsules,
  getCapsuleById,
  getValuesByCapsule,
  getVersionsByCapsule,
  insertCapsule,
  insertCapsuleVersion,
  upsertCapsuleValue,
  type Capsule,
  type CapsuleValue,
  type CapsuleVersion,
} from "@/entities/capsule";
import {
  addTagToCapsule,
  getTagByName,
  getTagsByCapsule,
  insertTag,
} from "@/entities/tag";
import { getLinksFrom, insertLink, type CapsuleLink } from "@/entities/link";
import {
  getRemindersByCapsule,
  insertReminder,
  type Reminder,
} from "@/entities/reminder";
import { insertAuditEntry } from "@/entities/audit";
import {
  parsePortable,
  PortableFormatError,
  serializePortable,
} from "@/shared/format";
import { generateId } from "@/shared/lib";

/**
 * Capsule scope of 5.2 — single capsule and whole collection. Both share
 * one payload shape (`PortableCapsuleSet`) and differ only in envelope
 * `kind` and in how many capsules are inside.
 *
 * Self-contained by design (CLAUDE.md: "does this capsule make sense on
 * its own?"): a set carries every `CapsuleType` + `CapsuleField` its
 * capsules reference, so an export opened on a device that has never seen
 * that type still restores a usable, correctly-typed capsule.
 *
 * Import follows the conversation scope's rule — everything comes back as
 * NEW data under fresh ids, every internal reference remapped
 * consistently. That includes types: importing the same capsule twice
 * produces two copies of its type, never a merge into an existing type
 * whose fields may have since diverged. Inside one collection import, all
 * capsules of one exported type share one restored type.
 *
 * References that point OUTSIDE the set degrade rather than dangle, per
 * CLAUDE.md's CapsuleLink rule:
 * - a link whose other end isn't in the set is dropped;
 * - a `parentCapsuleId` whose parent isn't in the set becomes `null`
 *   (the capsule comes back as root-level);
 * - a `capsuleTypeId` that was already dangling at export time is kept
 *   as-is, so the existing "Unknown type" display fallback still applies.
 *
 * Tags round-trip by name, not id: a tag is a user-level label, so an
 * imported "sci-fi" joins the local "sci-fi" tag instead of creating a
 * duplicate.
 *
 * Round-trips everything a capsule owns: values, tags, version history,
 * and reminders. Deliberately excluded — the complete list:
 * - embeddings: derived, model-specific data that can be rebuilt from the
 *   capsule's own text via `features/capsule-rag`'s `indexCapsule`.
 *   Nothing re-indexes an imported capsule automatically yet (no route
 *   calls `indexCapsule` at all until 7.2's wiring lands), so an imported
 *   capsule simply has no embedding until then — the same state as any
 *   capsule created in the app today.
 * - attachments: the portable format is JSON text and doesn't carry file
 *   bytes yet. Exporting attachment records without their files would
 *   round-trip nothing usable, so they're left out until the format can
 *   carry files — tracked in `.claude/loop/BLOCKED.md` ("Attachments
 *   aren't part of the portable format").
 */

const CAPSULE_KIND = "capsule";
const CAPSULE_COLLECTION_KIND = "capsule-collection";

type PortableCapsuleType = {
  type: CapsuleType;
  fields: CapsuleField[];
};

type PortableCapsuleEntry = {
  capsule: Capsule;
  values: CapsuleValue[];
  tags: string[];
  versions: CapsuleVersion[];
  reminders: Reminder[];
};

type PortableCapsuleSet = {
  types: PortableCapsuleType[];
  capsules: PortableCapsuleEntry[];
  links: CapsuleLink[];
};

function collectEntry(
  db: SQLiteDatabase,
  capsule: Capsule,
): PortableCapsuleEntry {
  return {
    capsule,
    values: getValuesByCapsule(db, capsule.id),
    tags: getTagsByCapsule(db, capsule.id).map((tag) => tag.name),
    versions: getVersionsByCapsule(db, capsule.id),
    reminders: getRemindersByCapsule(db, capsule.id),
  };
}

function collectType(
  db: SQLiteDatabase,
  type: CapsuleType,
): PortableCapsuleType {
  return { type, fields: getFieldsByCapsuleType(db, type.id) };
}

/** Only links with BOTH ends inside the set — anything else would dangle on import. */
function collectInternalLinks(
  db: SQLiteDatabase,
  capsules: Capsule[],
): CapsuleLink[] {
  const ids = new Set(capsules.map((c) => c.id));
  return capsules.flatMap((c) =>
    getLinksFrom(db, c.id).filter((link) => ids.has(link.toCapsuleId)),
  );
}

function restoreSet(db: SQLiteDatabase, set: PortableCapsuleSet): Capsule[] {
  const typeIds = new Map<string, string>();
  const fieldIds = new Map<string, string>();
  const capsuleIds = new Map<string, string>();

  for (const { type, fields } of set.types) {
    const newTypeId = generateId();
    typeIds.set(type.id, newTypeId);
    insertCapsuleType(db, { ...type, id: newTypeId });
    for (const field of fields) {
      const newFieldId = generateId();
      fieldIds.set(field.id, newFieldId);
      insertCapsuleField(db, {
        ...field,
        id: newFieldId,
        capsuleTypeId: newTypeId,
      });
    }
  }

  for (const { capsule } of set.capsules) {
    capsuleIds.set(capsule.id, generateId());
  }

  const remapField = (id: string) => fieldIds.get(id) ?? id;
  const restored: Capsule[] = [];
  const now = Date.now();

  for (const { capsule, values, tags, versions, reminders } of set.capsules) {
    const newId = capsuleIds.get(capsule.id)!;
    const restoredCapsule: Capsule = {
      ...capsule,
      id: newId,
      capsuleTypeId:
        typeIds.get(capsule.capsuleTypeId) ?? capsule.capsuleTypeId,
      parentCapsuleId:
        capsule.parentCapsuleId !== null
          ? (capsuleIds.get(capsule.parentCapsuleId) ?? null)
          : null,
    };
    insertCapsule(db, restoredCapsule);
    restored.push(restoredCapsule);

    for (const v of values) {
      upsertCapsuleValue(db, {
        ...v,
        id: generateId(),
        capsuleId: newId,
        fieldId: remapField(v.fieldId),
      });
    }

    for (const name of tags) {
      let tag = getTagByName(db, name);
      if (tag === null) {
        tag = { id: generateId(), name, createdAt: now, updatedAt: now };
        insertTag(db, tag);
      }
      addTagToCapsule(db, newId, tag.id, now);
    }

    for (const version of versions) {
      const remappedValues: Record<string, string | null> = {};
      for (const [fieldId, v] of Object.entries(version.values)) {
        remappedValues[remapField(fieldId)] = v;
      }
      insertCapsuleVersion(db, {
        ...version,
        id: generateId(),
        capsuleId: newId,
        values: remappedValues,
      });
    }

    for (const reminder of reminders) {
      // Imported reminders are records only: any notification id belonged to
      // the exporting device/time and means nothing here (8.8).
      insertReminder(db, {
        ...reminder,
        id: generateId(),
        capsuleId: newId,
        notificationId: null,
      });
    }
  }

  for (const link of set.links) {
    const from = capsuleIds.get(link.fromCapsuleId);
    const to = capsuleIds.get(link.toCapsuleId);
    if (from === undefined || to === undefined) continue;
    insertLink(db, {
      ...link,
      id: generateId(),
      fromCapsuleId: from,
      toCapsuleId: to,
      fieldId: link.fieldId !== null ? remapField(link.fieldId) : null,
    });
  }

  return restored;
}

/** Exports one capsule with its own type schema, values, tags, and history. */
export function exportCapsule(db: SQLiteDatabase, capsuleId: string): string {
  const capsule = getCapsuleById(db, capsuleId);
  if (capsule === null) {
    throw new Error(`No capsule with id "${capsuleId}"`);
  }
  const type = getCapsuleTypeById(db, capsule.capsuleTypeId);
  const json = serializePortable<PortableCapsuleSet>(CAPSULE_KIND, {
    types: type !== null ? [collectType(db, type)] : [],
    capsules: [collectEntry(db, capsule)],
    links: collectInternalLinks(db, [capsule]),
  });
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `Capsule "${capsule.title}"`,
    createdAt: Date.now(),
  });
  return json;
}

/** Imports a single-capsule export, always as a new capsule (with its own new type). */
export function importCapsule(db: SQLiteDatabase, json: string): Capsule {
  const set = parsePortable<PortableCapsuleSet>(json, CAPSULE_KIND);
  if (set.capsules.length !== 1) {
    throw new PortableFormatError(
      `A "${CAPSULE_KIND}" export must contain exactly one capsule, found ${set.capsules.length}`,
    );
  }
  const [restored] = restoreSet(db, set);
  return restored;
}

/**
 * Exports every capsule type (including types with no capsules yet) and
 * every capsule — the capsule half of "whole vault".
 */
export function exportAllCapsules(db: SQLiteDatabase): string {
  const capsules = getAllCapsules(db);
  const json = serializePortable<PortableCapsuleSet>(CAPSULE_COLLECTION_KIND, {
    types: getAllCapsuleTypes(db).map((type) => collectType(db, type)),
    capsules: capsules.map((capsule) => collectEntry(db, capsule)),
    links: collectInternalLinks(db, capsules),
  });
  insertAuditEntry(db, {
    id: generateId(),
    action: "export",
    detail: `All capsules (${capsules.length} capsule${capsules.length === 1 ? "" : "s"})`,
    createdAt: Date.now(),
  });
  return json;
}

/** Imports a whole-collection export, restoring every type and capsule as new. */
export function importAllCapsules(db: SQLiteDatabase, json: string): Capsule[] {
  const set = parsePortable<PortableCapsuleSet>(json, CAPSULE_COLLECTION_KIND);
  return restoreSet(db, set);
}
