import type { Bottle } from "@peated/server/types";

export class ConflictError extends Error {
  existingRow: Bottle;

  constructor(existingRow: Bottle) {
    super("A row with these values already exists");
    this.name = "ConflictError";
    this.existingRow = existingRow;
  }
}
