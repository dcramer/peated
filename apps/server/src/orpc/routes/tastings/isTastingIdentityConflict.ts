import { uniqueViolationConstraint } from "@peated/server/db/errors";

const TASTING_IDENTITY_CONSTRAINTS = new Set([
  "tasting_unq",
  "tasting_legacy_unq",
  "tasting_target_unq",
]);

/** Identifies a tasting identity collision through wrapped PostgreSQL errors. */
export function isTastingIdentityConflict(error: Error): boolean {
  return TASTING_IDENTITY_CONSTRAINTS.has(
    uniqueViolationConstraint(error) ?? "",
  );
}
