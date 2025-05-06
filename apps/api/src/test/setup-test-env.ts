// make sure to import this _before_ all other code
import "../sentry";

import "error-cause/auto";

import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { and, eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import { Client } from "pg";
import { beforeAll, beforeEach, vi } from "vitest";
import { db, pool } from "../db";
import { migrate } from "../db/migrate";
import "../lib/test/expects";
import * as fixtures from "../lib/test/fixtures";

process.env.DISABLE_HTTP_CACHE = "1";

const axiosMock = new MockAdapter(axios);

// vi.mock("axios");

// TODO: no fucking clue how to just use my mock module anymore and docs
// are almost non-existant
vi.mock("../worker/client", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const oJobs = await importOriginal<typeof import("../worker/client.js")>();
  return {
    pushJob: vi.fn(() => Promise<void>),
    pushUniqueJob: vi.fn(() => Promise<void>),
    runJob: oJobs.runJob,
    gracefulShutdown: vi.fn(() => Promise<void>),
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

  await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames} CASCADE;`));

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
    // TODO:
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
    await pool.end();
    throw new Error("Unable to run db migrations", { cause: err });
  }

  return async () => {
    await pool.end();
  };
});

beforeEach(async (ctx) => {
  ctx.axiosMock = axiosMock;

  return () => {
    axiosMock.reset();
  };
});

beforeEach(async (ctx) => {
  await clearTables();

  const user = await createDefaultUser();

  ctx.defaults = {
    user,
    authHeaders: await fixtures.AuthenticatedHeaders({ user }),
  };
  ctx.fixtures = fixtures;
});
