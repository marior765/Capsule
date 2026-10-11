import type { SQLiteDatabase } from "expo-sqlite";
import {
  createBackupBundle,
  restoreBackupBundle,
} from "@/features/backup-restore";
import {
  exportAllConversations,
  exportCapsulesBundle,
  importAllConversations,
  importCapsulesBundle,
} from "@/features/import-export";
import {
  importChatGptExport,
  importClaudeExport,
  importCsv,
  importJsonRecords,
  importMarkdownNotes,
} from "@/features/migrate-import";
import { scheduleUnscheduledReminders } from "@/features/manage-reminders";
import {
  deleteCacheDirectoryIfExists,
  deleteCacheFileIfExists,
  EXPORTS_CACHE_DIRECTORY,
  readFileUriBytes,
  writeCacheFileBytes,
} from "@/shared/fs";
import { PortableFormatError } from "@/shared/format";
import type { PickedSource } from "@/shared/picker";
import { textFromBytes, textToBytes } from "@/shared/zip";

/**
 * What the Import & Export screen does (5.5), composed here because it
 * spans several features (which can't import each other). The screen only
 * adds buttons, confirmations and the share sheet.
 */

export type ExportKind = "backup" | "capsules" | "conversations";

export type ImportKind =
  | "backup"
  | "capsules"
  | "conversations"
  | "chatgpt"
  | "claude"
  | "csv"
  | "json"
  | "markdown";

export type ImportOutcome = {
  message: string;
  /** A restore replaced everything: restart so no screen shows old data. */
  restartNeeded: boolean;
  /** New capsules — the caller indexes them for capsule search. */
  capsuleIds: string[];
};

const pad = (n: number) => String(n).padStart(2, "0");

export function exportFileName(kind: ExportKind, now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const extension = kind === "conversations" ? "json" : "zip";
  return `Capsule ${kind} ${date}.${extension}`;
}

/** Builds the export and writes it to a temporary file, ready for the share sheet. */
export async function exportForSharing(
  db: SQLiteDatabase,
  kind: ExportKind,
  now: Date = new Date(),
): Promise<{ uri: string; mimeType: string }> {
  const bytes =
    kind === "backup"
      ? await createBackupBundle(db)
      : kind === "capsules"
        ? await exportCapsulesBundle(db)
        : textToBytes(exportAllConversations(db));
  // One export at a time: older ones (plaintext copies) go first.
  deleteCacheDirectoryIfExists(EXPORTS_CACHE_DIRECTORY);
  return {
    uri: writeCacheFileBytes(
      exportFileName(kind, now),
      bytes,
      EXPORTS_CACHE_DIRECTORY,
    ),
    mimeType: kind === "conversations" ? "application/json" : "application/zip",
  };
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const baseName = (name: string) =>
  name.replace(/\.[^.]+$/, "").trim() || "Imported";

const KIND_LABEL: Record<ImportKind, string> = {
  backup: "Capsule backup",
  capsules: "Capsule capsules export",
  conversations: "Capsule conversations export",
  chatgpt: "ChatGPT export",
  claude: "Claude export",
  csv: "CSV file",
  json: "JSON records file",
  markdown: "Markdown file",
};

/** Kinds whose content can carry reminders (only Capsule's own zips). */
const BRINGS_REMINDERS = new Set<ImportKind>(["backup", "capsules"]);

/**
 * Imports a file the user picked. `confirm` (e.g. "Replace everything?")
 * runs first; declining resolves to null. The picker's temporary copy is
 * deleted afterwards on every path — success, failure or cancel. A file
 * that isn't what was asked for fails with a plain-words message.
 */
export async function importFile(
  db: SQLiteDatabase,
  kind: ImportKind,
  picked: PickedSource,
  options: { confirm?: () => Promise<boolean> } = {},
): Promise<ImportOutcome | null> {
  try {
    if (options.confirm && !(await options.confirm())) return null;
    try {
      const outcome = await runImport(db, kind, picked);
      if (BRINGS_REMINDERS.has(kind)) {
        try {
          await scheduleUnscheduledReminders(db);
        } catch {
          // the import itself worked; reminders stay records until moved
        }
      }
      return outcome;
    } catch (error) {
      throw friendlyImportError(kind, error);
    }
  } finally {
    try {
      deleteCacheFileIfExists(picked.uri);
    } catch {
      // the OS clears its cache; the full wipe clears picker folders
    }
  }
}

function friendlyImportError(kind: ImportKind, error: unknown): unknown {
  const parsing =
    error instanceof PortableFormatError ||
    error instanceof SyntaxError ||
    (error instanceof Error && error.name === "ZipError") ||
    !BRINGS_REMINDERS.has(kind); // the text importers only parse
  return parsing && error instanceof Error
    ? new Error(`This doesn't look like a ${KIND_LABEL[kind]}.`, {
        cause: error,
      })
    : error;
}

async function runImport(
  db: SQLiteDatabase,
  kind: ImportKind,
  picked: PickedSource,
): Promise<ImportOutcome> {
  const bytes = await readFileUriBytes(picked.uri);
  const text = () => textFromBytes(bytes);
  const capsules = (ids: string[]): ImportOutcome => {
    return {
      message: `Imported ${plural(ids.length, "capsule", "capsules")}.`,
      restartNeeded: false,
      capsuleIds: ids,
    };
  };
  const conversations = (count: number): ImportOutcome => ({
    message: `Imported ${plural(count, "conversation", "conversations")}.`,
    restartNeeded: false,
    capsuleIds: [],
  });

  switch (kind) {
    case "backup":
      await restoreBackupBundle(db, bytes);
      return {
        message: "Backup restored.",
        restartNeeded: true,
        capsuleIds: [],
      };
    case "capsules":
      return capsules((await importCapsulesBundle(db, bytes)).map((c) => c.id));
    case "conversations":
      return conversations(importAllConversations(db, text()).length);
    case "chatgpt":
      return conversations(importChatGptExport(db, text()).length);
    case "claude":
      return conversations(importClaudeExport(db, text()).length);
    case "csv":
      return capsules(
        importCsv(db, text(), baseName(picked.name)).capsules.map((c) => c.id),
      );
    case "json":
      return capsules(
        importJsonRecords(db, text(), baseName(picked.name)).capsules.map(
          (c) => c.id,
        ),
      );
    case "markdown":
      return capsules(
        importMarkdownNotes(db, [
          { name: picked.name, text: text() },
        ]).capsules.map((c) => c.id),
      );
    default: {
      const unknown: never = kind;
      throw new Error(`Unknown import: ${String(unknown)}`);
    }
  }
}
