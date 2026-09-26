import { ProposedOperationSchema } from "@peated/bottle-classifier";

// Bump when persisted Bottle Check output or operation shapes stop parsing.
// Older rows stay opaque so reviewers rerun them instead of executing stale data.
export const BOTTLE_CHECK_SCHEMA_VERSION = 2;

export class UnsupportedBottleCheckSchemaVersionError extends Error {
  constructor(
    readonly checkId: number,
    readonly schemaVersion: number,
  ) {
    super(
      `Bottle check ${checkId} uses unsupported schema version ${schemaVersion}; rerun the check before executing its operations.`,
    );
    this.name = "UnsupportedBottleCheckSchemaVersionError";
  }
}

export function assertSupportedBottleCheckSchemaVersion(check: {
  id: number;
  schemaVersion: number;
}): void {
  if (!isSupportedBottleCheckSchemaVersion(check)) {
    throw new UnsupportedBottleCheckSchemaVersionError(
      check.id,
      check.schemaVersion,
    );
  }
}

export function isSupportedBottleCheckSchemaVersion(check: {
  schemaVersion: number;
}): boolean {
  return check.schemaVersion === BOTTLE_CHECK_SCHEMA_VERSION;
}

// Catalog moderation owns this rule: a saved proposal that no longer parses
// (a removed field, a tighter limit) makes its check unsupported, not a 500.
export function isSupportedBottleCheck(check: {
  schemaVersion: number;
  operations: ReadonlyArray<{ proposal: unknown }>;
}): boolean {
  return (
    isSupportedBottleCheckSchemaVersion(check) &&
    check.operations.every(
      ({ proposal }) => ProposedOperationSchema.safeParse(proposal).success,
    )
  );
}
