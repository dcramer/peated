import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import config from "../config";
import { logDebug } from "../lib/log";
import { getPostgresConnectionConfig } from "./connection";
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
  const poolConfig = getPostgresConnectionConfig();
  if (config.ENV === "test") {
    // Vitest can re-evaluate modules across suites. Reusing one low-concurrency
    // pool in test mode avoids exhausting local Postgres clients.
    poolConfig.application_name = TEST_DB_APPLICATION_NAME;
    poolConfig.max = 1;
    poolConfig.idleTimeoutMillis = 0;
  }
  return new Pool(poolConfig);
}

export const pool = globalThis.__peatedPgPool ?? createPool();

if (config.ENV !== "production") {
  globalThis.__peatedPgPool = pool;
}

export const db = drizzle(pool, {
  schema,
  // Database logging excludes parameter values, which can contain private text.
  logger: config.DEBUG
    ? { logQuery: (query) => logDebug("Database query", { extra: { query } }) }
    : false,
});

export type AnyConnection = typeof db;

export type AnyTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type AnyDatabase = AnyTransaction | AnyConnection;
