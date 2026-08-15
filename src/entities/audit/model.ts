/**
 * The four privacy-sensitive action classes named in CLAUDE.md's hard rule:
 * "Privacy-sensitive actions (export, decrypt, wipe, model download) must
 * write to the audit entity." Kept as a closed union rather than a bare
 * `string` so every call site is checked against that exact list.
 */
export type AuditAction = "export" | "decrypt" | "wipe" | "model_download";

export type AuditEntry = {
  id: string;
  action: AuditAction;
  /** Free-form context — which model, which capsule, how many records. */
  detail: string | null;
  createdAt: number;
};

export type AuditEntryRow = {
  id: string;
  action: string;
  detail: string | null;
  created_at: number;
};

export function rowToAuditEntry(row: AuditEntryRow): AuditEntry {
  return {
    id: row.id,
    action: row.action as AuditAction,
    detail: row.detail ?? null,
    createdAt: row.created_at,
  };
}
