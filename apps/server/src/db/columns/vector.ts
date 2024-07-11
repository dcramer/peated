import { customType } from "drizzle-orm/pg-core";

type VectorOptions = {
  length: number;
};

type VectorType = Array<number>;

export function vector<TData extends VectorType>(
  name: string,
  options: VectorOptions,
) {
  return customType<{ data: TData; driverData: string }>({
    // this should be sql``, otherwise it outputs as a string
    dataType() {
      return `vector(${options.length})`;
    },

    toDriver(value: TData) {
      if (Array.isArray(value)) return `[${value.map(String).join(",")}]`;
      return value;
    },
  })(name);
}
