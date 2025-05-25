import { ORPCError } from "@orpc/server";

type ConflictMatch = { id: any } & Record<string, any>;

export class ConflictError extends ORPCError<
  "CONFLICT",
  { existingRow: ConflictMatch }
> {
  public existingRow: ConflictMatch;

  constructor(
    row: ConflictMatch,
    err: Error | undefined = undefined,
    message: string | undefined = undefined,
  ) {
    super("CONFLICT", {
      message: message ?? `Conflicting object already exists (ID=${row.id}).`,
      cause: err,
      data: { existingRow: row },
    });
    this.existingRow = row;
  }
}
