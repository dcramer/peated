import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import config from "../config";
import * as schema from "./schema";

// I love to ESM.
import { default as pg } from "pg";
const { Pool } = pg;
type NodePgPool = InstanceType<typeof Pool>;
const TEST_DB_APPLICATION_NAME = "peated-vitest";

declare global {
  interface BigInt {
    toJSON(): string;
  }

  // eslint-disable-next-line no-var
  var __peatedPgPool: NodePgPool | undefined;
}

BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

function createPool(): NodePgPool {
  const connectionConfig = process.env.INSTANCE_UNIX_SOCKET
    ? {
        host: process.env.INSTANCE_UNIX_SOCKET,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      }
    : {
        connectionString: process.env.DATABASE_URL,
      };

  return new Pool({
    ...connectionConfig,
    // Vitest can re-evaluate modules across suites. Reusing one low-concurrency
    // pool in test mode avoids exhausting local Postgres clients.
    ...(config.ENV === "test"
      ? {
          application_name: TEST_DB_APPLICATION_NAME,
          max: 1,
          idleTimeoutMillis: 0,
        }
      : {}),
  });
}

export const pool = globalThis.__peatedPgPool ?? createPool();

if (config.ENV !== "production") {
  globalThis.__peatedPgPool = pool;
}

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
