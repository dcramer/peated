import { ORPCError } from "@orpc/server";
import {
  EntityAboutVersionError,
  EntityAboutWriteError,
} from "@peated/server/lib/entityAbout/store";

interface ConflictMatch {
  id: number;
}

export class ConflictError extends ORPCError<
  "CONFLICT",
  { existingRow: ConflictMatch }
> {
  public existingRow: ConflictMatch;

  constructor(row: ConflictMatch, err?: Error, message?: string) {
    super("CONFLICT", {
      message: message ?? `Conflicting object already exists (ID=${row.id}).`,
      cause: err,
      data: { existingRow: row },
    });
    this.existingRow = row;
  }
}

/**
 * Runs an About write and rethrows store errors as route errors: a stale
 * version is a conflict and a broken save rule is a bad request. Other
 * errors pass through.
 */
export async function withAboutRouteErrors<T>(
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof EntityAboutVersionError) {
      throw new ORPCError("CONFLICT", { message: error.message });
    }
    if (error instanceof EntityAboutWriteError) {
      throw new ORPCError("BAD_REQUEST", {
        message: error.reasons.join(" "),
      });
    }
    throw error;
  }
}
