// make sure to import this _before_ all other code
import "../sentry";

import { and, eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import mockAxios from "vitest-mock-axios";
import { db, pool } from "../db";
import { migrate } from "../db/migrate";
import "../lib/test/expects";
import * as fixtures from "../lib/test/fixtures";

process.env.DISABLE_HTTP_CACHE = "1";

vi.mock("axios");
vi.mock("@peated/server/jobs/client");

afterEach(() => {
  mockAxios.reset();
});

global.DefaultFixtures = {};

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

const getTableNames = async (exclude = SAFE_TABLES) => {
  const tnQuery = await db
    .select({ tablename: pgTables.tablename })
    .from(pgTables)
    .where(eq(pgTables.schemaname, schemaname));

  return tnQuery
    .filter(({ tablename }) => !exclude.includes(tablename))
    .map(({ tablename }) => `"${schemaname}"."${tablename}"`)
    .join(", ");
};

const dropTables = async () => {
  const tableNames = await getTableNames([]);
  if (!tableNames.length) return;

  try {
    await db.execute(sql.raw(`DROP TABLE ${tableNames} CASCADE;`));
  } catch (error) {
    console.error({ error });
  }
};

const clearTables = async () => {
  const tableNames = await getTableNames();
  if (!tableNames.length) return;

  try {
    await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE;`));
  } catch (error) {
    console.error({ error });
  }

  // reset sequences
  const snQuery = await db
    .select({ relname: pgClass.relname })
    .from(pgClass)
    .innerJoin(pgNamespace, eq(pgNamespace.oid, pgClass.relnamespace))
    .where(and(eq(pgClass.relkind, "S"), eq(pgNamespace.nspname, schemaname)));
  for (const { relname } of snQuery) {
    if (!relname.startsWith("__drizzle_migrations")) {
      await db.execute(
        sql.raw(`ALTER SEQUENCE "${schemaname}"."${relname}" RESTART WITH 1;`),
      );
    }
  }
};

const createDefaultUser = async () => {
  return await fixtures.User({
    email: "fizz.buzz@example.com",
    displayName: "Fizzy Buzz",
    username: "fizz.buzz",
  });
};

async function setupDatabase() {
  const [host, username, password] = ["localhost", "postgres", "postgres"];
  const client = new Client({ host, user: username, password });
  await client.connect();

  const applicationDatabaseName = "test_peated";

  const dbQuery = await client.query(
    `SELECT FROM pg_database WHERE datname = $1`,
    [applicationDatabaseName],
  );
  if (dbQuery.rows.length === 0) {
    // database does not exist, make it:
    await client.query(`CREATE DATABASE ${applicationDatabaseName}`);
  } else {
    // await dropTables();
  }

  client.end();
}

beforeAll(async () => {
  await setupDatabase();

  // this will automatically run needed migrations on the database
  try {
    await migrate({ db });
  } catch (err) {
    console.error("Unable to run db migrations", err);
    // process.exit(1);
    throw err;
  }
});

beforeEach(async (ctx) => {
  await clearTables();

  const user = await createDefaultUser();

  ctx.defaults = {
    user,
    authHeaders: await fixtures.AuthenticatedHeaders({ user }),
  };
  ctx.fixtures = fixtures;

  global.DefaultFixtures = {
    user,
    authHeaders: ctx.defaultAuthHeaders,
  };
});

afterEach(async (ctx) => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});
