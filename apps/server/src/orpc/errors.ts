import { ORPCError } from "@orpc/server";

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
