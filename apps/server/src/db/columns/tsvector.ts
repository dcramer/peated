import { customType } from "drizzle-orm/pg-core";

// Only the retained legacy bottle_release table still declares this column.
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
