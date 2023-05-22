import { ExtractTablesWithRelations } from "drizzle-orm";
import { NodePgQueryResultHKT, drizzle } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import config from "../config";
import * as schema from "./schema";

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

export const db = drizzle(pool, { logger: config.DEBUG, schema });

export type DatabaseType = typeof db;

export type TransactionType = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
