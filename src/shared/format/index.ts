/**
 * "shared/format — versioned portable format spec + serializers"
 * (docs/DEVELOPMENT_PLAN.md 5.1). Ties to CLAUDE.md's "Open portable
 * format" differentiator and its standing convention "every persisted
 * entity must round-trip through the portable format" — zero lock-in, no
 * proprietary storage the user can't get their data back out of.
 *
 * Deliberately domain-agnostic, matching `shared/`'s own layering
 * principle (no domain logic here — see docs/ARCHITECTURE.md's slice map).
 * This module owns only the generic envelope (version + kind + timestamp +
 * payload) and its (de)serialization; it has no idea what a "conversation"
 * or "capsule" actually is. Each entity's own slice is responsible for
 * calling `wrapPortable`/`unwrapPortable` with its own data and a `kind`
 * string it picks — that wiring is Phase 5.2's job
 * (`features/import-export`), not this step's.
 *
 * Versioning: only `CURRENT_FORMAT_VERSION` is accepted today. There is
 * exactly one version so far, so there is nothing to migrate yet — a real
 * migration path (accepting an older version and upgrading it) is
 * deliberately not built until a second version actually exists, the same
 * YAGNI discipline docs/ARCHITECTURE.md already applies to `shared/fs`.
 * `unwrapPortable`/`parsePortable` reject anything else with a clear error
 * rather than silently misreading a shape they don't understand.
 */

export const CURRENT_FORMAT_VERSION = 1;

export type PortableEnvelope<T> = {
  formatVersion: number;
  kind: string;
  exportedAt: number;
  data: T;
};

export class PortableFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortableFormatError";
  }
}

/** Wraps arbitrary data in a versioned, kind-tagged envelope. */
export function wrapPortable<T>(kind: string, data: T): PortableEnvelope<T> {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    kind,
    exportedAt: Date.now(),
    data,
  };
}

/**
 * Unwraps an envelope, verifying it's the expected `kind` and a format
 * version this module actually understands. Throws `PortableFormatError`
 * on either mismatch — never silently returns data of the wrong shape.
 */
export function unwrapPortable<T>(
  envelope: PortableEnvelope<T>,
  expectedKind: string,
): T {
  if (envelope.formatVersion !== CURRENT_FORMAT_VERSION) {
    throw new PortableFormatError(
      `Unsupported format version ${envelope.formatVersion} (this app understands version ${CURRENT_FORMAT_VERSION})`,
    );
  }
  if (envelope.kind !== expectedKind) {
    throw new PortableFormatError(
      `Expected a "${expectedKind}" envelope, got "${envelope.kind}"`,
    );
  }
  return envelope.data;
}

/** Serializes data to human-readable (indented) JSON, wrapped in an envelope. */
export function serializePortable<T>(kind: string, data: T): string {
  return JSON.stringify(wrapPortable(kind, data), null, 2);
}

/**
 * Parses and validates a portable JSON string, returning the unwrapped
 * data. Throws `PortableFormatError` for malformed JSON, a non-object
 * value, a missing `formatVersion`/`data` field, or a kind/version
 * mismatch — every failure mode this module can detect is a
 * `PortableFormatError`, never a raw `SyntaxError` or a silent `undefined`.
 */
export function parsePortable<T>(json: string, expectedKind: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PortableFormatError("Not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PortableFormatError(
      "Expected a JSON object, not an array or primitive",
    );
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate.formatVersion !== "number") {
    throw new PortableFormatError("Missing or invalid formatVersion field");
  }
  if (!("data" in candidate)) {
    throw new PortableFormatError("Missing data field");
  }

  return unwrapPortable(
    {
      formatVersion: candidate.formatVersion,
      kind: typeof candidate.kind === "string" ? candidate.kind : "",
      exportedAt:
        typeof candidate.exportedAt === "number" ? candidate.exportedAt : 0,
      data: candidate.data as T,
    },
    expectedKind,
  );
}
