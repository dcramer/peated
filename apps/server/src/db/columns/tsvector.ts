import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

export function tsvector<TData>(name: string) {
  return customType<{ data: TData; driverData: string }>({
    dataType() {
      return "tsvector";
    },

    toDriver(value: TData) {
      return sql`to_tsvector(${value})`;
    },
  })(name);
}
