import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import config from "../config";
import { AnyPgTable } from "drizzle-orm/pg-core";
import { and, eq } from "drizzle-orm";

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { logger: config.DEBUG });

// export const findFirst = async (
//   table: AnyPgTable,
//   query: {
//     [name: string]: any;
//   }
// ) => {
//   const [{ result }] = await db
//     .select({ result: table })
//     .from(table)
//     .where(and(...Object.entries(query).map(([k, v]) => eq(table[k], v))))
//     .limit(1);
//   return result;
// };
