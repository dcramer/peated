import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import config from "../config";
import * as schema from "./schema";

// I love to ESM.
import { default as pg } from "pg";
const { Pool } = pg;

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

export const pool = new Pool(
  process.env.INSTANCE_UNIX_SOCKET
    ? {
        host: process.env.INSTANCE_UNIX_SOCKET,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      }
    : {
        connectionString: process.env.DATABASE_URL,
      },
);

export const db = drizzle(pool, {
  schema,
  logger: config.DEBUG,
});

export type AnyConnection = typeof db;

export type AnyTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type AnyDatabase = AnyTransaction | AnyConnection;
