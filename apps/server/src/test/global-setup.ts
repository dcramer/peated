import { drizzle } from "drizzle-orm/node-postgres";
import pg, { Client } from "pg";
import { migrate } from "../db/migrate";
import * as schema from "../db/schema";

const TEST_DB_APPLICATION_NAME = "peated-vitest";

function getSetupDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for backend tests");
  }

  const parsedUrl = new URL(databaseUrl);
  const applicationDatabaseName =
    parsedUrl.pathname.replace(/^\//, "") || "test_peated";

  return {
    applicationDatabaseName,
    maintenanceConnectionConfig: {
      database: "postgres",
      host: parsedUrl.hostname || "localhost",
      password: decodeURIComponent(parsedUrl.password),
      port: parsedUrl.port ? Number(parsedUrl.port) : 5432,
      user: decodeURIComponent(parsedUrl.username) || "postgres",
    },
  };
}

async function setupDatabase(): Promise<void> {
  const { applicationDatabaseName, maintenanceConnectionConfig } =
    getSetupDatabaseConfig();
  const client = new Client(maintenanceConnectionConfig);
  await client.connect();
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
