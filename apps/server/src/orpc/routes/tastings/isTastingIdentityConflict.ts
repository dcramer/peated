import { z } from "zod";

const TASTING_IDENTITY_CONSTRAINTS = new Set([
  "tasting_unq",
  "tasting_legacy_unq",
  "tasting_target_unq",
]);
const DatabaseErrorSchema = z.object({
  code: z.string().optional(),
  constraint: z.string().optional(),
});

/** Identifies a tasting identity collision through wrapped PostgreSQL errors. */
export function isTastingIdentityConflict(error: Error): boolean {
  let current: Error = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const candidate = DatabaseErrorSchema.safeParse(current);
    if (candidate.success && candidate.data.code === "23505") {
      return (
        candidate.data.constraint !== undefined &&
        TASTING_IDENTITY_CONSTRAINTS.has(candidate.data.constraint)
      );
    }
    if (!(current.cause instanceof Error)) return false;
    current = current.cause;
  }
  return false;
}
