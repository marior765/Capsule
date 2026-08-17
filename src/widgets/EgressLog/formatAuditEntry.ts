import type { AuditAction } from "@/entities/audit";

/** Human-readable label for an audit action — kept exhaustive against
 * AuditAction's closed union so a future action added there fails tsc
 * here rather than silently rendering nothing. */
export function formatAuditAction(action: AuditAction): string {
  switch (action) {
    case "export":
      return "Exported data";
    case "decrypt":
      return "Vault unlocked";
    case "wipe":
      return "Data wiped";
    case "model_download":
      return "Model downloaded";
  }
}

export function formatAuditTimestamp(createdAt: number): string {
  return new Date(createdAt).toLocaleString();
}
