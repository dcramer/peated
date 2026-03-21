import { drizzle } from "drizzle-orm/node-postgres";
import pg, { Client } from "pg";
import { migrate } from "../db/migrate";
import * as schema from "../db/schema";

const TEST_DB_APPLICATION_NAME = "peated-vitest";

async function setupDatabase(): Promise<void> {
  const [host, username, password] = ["localhost", "postgres", "postgres"];
  const client = new Client({ host, user: username, password });
  await client.connect();

  const applicationDatabaseName = "test_peated";
  const dbQuery = await client.query(
    `SELECT FROM pg_database WHERE datname = $1`,
    [applicationDatabaseName],
  );

  if (dbQuery.rows.length === 0) {
    await client.query(`CREATE DATABASE ${applicationDatabaseName}`);
  }

  await client.query(
    `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND application_name = $2
        AND pid <> pg_backend_pid()
    `,
    [applicationDatabaseName, TEST_DB_APPLICATION_NAME],
  );

  await client.end();
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const migrationPool = new pg.Pool({
    application_name: TEST_DB_APPLICATION_NAME,
    connectionString: process.env.DATABASE_URL,
  });
  const migrationDb = drizzle(migrationPool, {
    schema,
  });

  await setupDatabase();

  try {
    await migrate({ db: migrationDb });
  } catch (err) {
    await migrationPool.end();
    throw new Error("Unable to run db migrations", { cause: err });
  }

  await migrationPool.end();

  return async () => undefined;
}
