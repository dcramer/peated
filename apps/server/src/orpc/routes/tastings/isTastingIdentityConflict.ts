const TASTING_IDENTITY_CONSTRAINTS = new Set([
  "tasting_unq",
  "tasting_legacy_unq",
  "tasting_target_unq",
]);

/** Identifies a tasting identity collision through wrapped PostgreSQL errors. */
export function isTastingIdentityConflict(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const candidate = current as Error & {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (candidate.code === "23505") {
      return (
        candidate.constraint !== undefined &&
        TASTING_IDENTITY_CONSTRAINTS.has(candidate.constraint)
      );
    }
    current = candidate.cause;
  }
  return false;
}
