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
