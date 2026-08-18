/**
 * A reusable schema/template ("CapsuleType" in CLAUDE.md's Capsule domain
 * model) — defines the shape a `Capsule` instance takes via its associated
 * `CapsuleField` definitions (entities/field, a sibling slice). This
 * entity itself only holds the template's own identity — name and an
 * optional description — not its fields.
 */
export type CapsuleType = {
  id: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CapsuleTypeRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToCapsuleType(row: CapsuleTypeRow): CapsuleType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
