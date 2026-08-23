import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";
import { z } from "zod";

type TSVectorWeight = "A" | "B" | "C" | "D";

export class TSVector {
  value: string;
  weight: TSVectorWeight;

  constructor(value: string, weight: TSVectorWeight = "A") {
    this.value = value;
    this.weight = weight;
  }

  mapToDriverValue() {
    // Search queries must use the same language and accent normalization.
    return sql`setweight(to_tsvector('english', unaccent(${this.value})), ${this.weight})`;
  }
}

type TSVectorType = string | TSVector | TSVector[];

export function tsvector<TData extends TSVectorType = string>(name: string) {
  return customType<{ data: TData; driverData: string }>({
    dataType() {
      return "tsvector";
    },

    toDriver(value: TData) {
      const textValue = z.string().safeParse(value);
      if (textValue.success)
        return sql`to_tsvector('english', unaccent(${textValue.data}))`;
      else if (Array.isArray(value))
        return sql.join(
          value.map((v) => v.mapToDriverValue()),
          sql` || ' ' || `,
        );
      return z.instanceof(TSVector).parse(value).mapToDriverValue();
    },
  })(name);
}
