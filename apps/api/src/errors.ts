import { ConflictError as HttpConflictError } from "http-errors-enhanced";

type ConflictMatch = { id: any } & Record<string, any>;

export class ConflictError extends HttpConflictError {
  public existingRow: ConflictMatch;

  constructor(
    row: ConflictMatch,
    err: Error | undefined = undefined,
    message: string | undefined = undefined,
  ) {
    super(message ?? `Conflicting object already exists (ID=${row.id}).`, {
      cause: err,
    });
    this.existingRow = row;
  }
}
