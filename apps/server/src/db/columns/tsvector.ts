import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

type TSVectorWeight = "A" | "B" | "C" | "D";

export class TSVector {
  value: string;
  weight: TSVectorWeight;

  constructor(value: string, weight: TSVectorWeight = "A") {
    this.value = value;
    this.weight = weight;
  }

  mapToDriverValue() {
    return sql`setweight(to_tsvector(${this.value}), ${this.weight})`;
  }
}

type TSVectorType = string | TSVector | TSVector[];

export function tsvector<TData extends TSVectorType = string>(name: string) {
  return customType<{ data: TData; driverData: string }>({
    dataType() {
      return "tsvector";
    },

    toDriver(value: TData) {
      if (typeof value === "string") return sql`to_tsvector(${value})`;
      if (Array.isArray(value))
        return sql.join(
          value.map((v) => v.mapToDriverValue()),
          sql` || ' ' || `
        );
      return value.mapToDriverValue();
    },
  })(name);
}
