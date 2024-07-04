import { TRPCError } from "@trpc/server";

type ConflictMatch = { id: any } & Record<string, any>;

export class ConflictError extends TRPCError {
  public existingRow: ConflictMatch;

  constructor(row: ConflictMatch, err: Error) {
    super({
      message: `Bottle with already exists (ID=${row.id}).`,
      code: "CONFLICT",
      cause: err,
    });
    this.existingRow = row;
  }
}
