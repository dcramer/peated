// make sure to import this _before_ all other code
import "../sentry";

import "error-cause/auto";

import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { and, eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { beforeEach, vi } from "vitest";
import { db, type AnyDatabase } from "../db";
import "../lib/test/expects";
import * as fixtures from "../lib/test/fixtures";

process.env.DISABLE_HTTP_CACHE = "1";

const axiosMock = new MockAdapter(axios);

// vi.mock("axios");

// TODO: no fucking clue how to just use my mock module anymore and docs
// are almost non-existant
vi.mock("../worker/client", () => {
  return {
    pushJob: vi.fn(async () => undefined),
    pushUniqueJob: vi.fn(async () => undefined),
    runJob: vi.fn(async () => undefined),
    gracefulShutdown: vi.fn(async () => undefined),
    getConnection: vi.fn(async () => null),
  };
});

// XXX: doing this causes the module to catch and more or less all mocks to break
// force registration of all jobs
// import "../worker/jobs";

const pgTables = pgTable("pg_tables", {
  schemaname: text("schemaname").notNull(),
  tablename: text("tablename").notNull(),
});

const pgClass = pgTable("pg_class", {
  relname: text("relname").notNull(),
  relkind: text("relkind").notNull(),
  relnamespace: text("relnamespace").notNull(),
});

const pgNamespace = pgTable("pg_namespace", {
  oid: text("oid").notNull(),
  nspname: text("nspname").notNull(),
});

const schemaname = "public";
const SAFE_TABLES = ["__drizzle_migrations"];
const TEST_DATABASE_RESET_LOCK_ID = 287441;
let cachedResettableTables: string | null = null;
let cachedResettableSequences: string[] | null = null;

const getResettableTables = async (
  exclude = SAFE_TABLES,
  conn: AnyDatabase = db,
) => {
  if (exclude === SAFE_TABLES && cachedResettableTables) {
    return cachedResettableTables;
  }

  const tnQuery = await conn
    .select({ tablename: pgTables.tablename })
    .from(pgTables)
    .where(eq(pgTables.schemaname, schemaname));

  const tableNames = tnQuery
    .filter(({ tablename }) => !exclude.includes(tablename))
    .map(({ tablename }) => `"${schemaname}"."${tablename}"`)
    .join(", ");

  if (exclude === SAFE_TABLES) {
    cachedResettableTables = tableNames;
  }

  return tableNames;
};

const getResettableSequences = async (conn: AnyDatabase = db) => {
  if (cachedResettableSequences) {
    return cachedResettableSequences;
  }

  const sequenceRows = await conn
    .select({ relname: pgClass.relname })
    .from(pgClass)
    .innerJoin(pgNamespace, eq(pgNamespace.oid, pgClass.relnamespace))
    .where(and(eq(pgClass.relkind, "S"), eq(pgNamespace.nspname, schemaname)));

  cachedResettableSequences = sequenceRows
    .map(({ relname }) => relname)
    .filter((relname) => !relname.startsWith("__drizzle_migrations"));

  return cachedResettableSequences;
};

const clearTables = async (conn: AnyDatabase = db) => {
  const tableNames = await getResettableTables(SAFE_TABLES, conn);
  if (!tableNames.length) return;

  await conn.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE;`));

  const sequenceNames = await getResettableSequences(conn);
  for (const sequenceName of sequenceNames) {
    await conn.execute(
      sql.raw(
        `ALTER SEQUENCE "${schemaname}"."${sequenceName}" RESTART WITH 1;`,
      ),
    );
  }
};

/**
 * Creates a default user for testing purposes.
 *
 * This user will have basic permissions (no admin, no mod).
 *
 * @returns The created user.
 */
const createDefaultUser = async (conn: AnyDatabase = db) => {
  return await fixtures.User(
    {
      email: "fizz.buzz@example.com",
      displayName: "Fizzy Buzz",
      username: "fizz.buzz",
      admin: false,
      mod: false,
      active: true,
    },
    conn,
  );
};

beforeEach(async (ctx) => {
  ctx.axiosMock = axiosMock;

  return () => {
    axiosMock.reset();
  };
});

beforeEach(async (ctx) => {
  // Clear rate limit keys from Redis
  try {
    const oJobs = await import("../worker/client");
    const redis = await oJobs.getConnection();
    if (redis) {
      const rateLimitPrefixes = ["rl:*", "auth:*", "auth-strict:*"];
      for (const prefix of rateLimitPrefixes) {
        const keys = await redis.keys(prefix);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    }
  } catch {
    // Redis not available in test environment - continue without clearing
    // rate limits.
  }

  const user = await db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`SELECT pg_advisory_xact_lock(${TEST_DATABASE_RESET_LOCK_ID});`),
    );

    await clearTables(tx);
    return await createDefaultUser(tx);
  });

  ctx.defaults = {
    user,
    authHeaders: await fixtures.AuthenticatedHeaders({ user }),
  };
  ctx.fixtures = fixtures;
});
