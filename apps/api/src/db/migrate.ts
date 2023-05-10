import { db } from "../lib/db";
import {
  MigrationConfig,
  MigrationMeta,
  readMigrationFiles,
} from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

const patchedMigrate = async function (
  migrations: MigrationMeta[],
  db: NodePgDatabase
): Promise<void> {
  const migrationTableCreate = sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await db.execute(migrationTableCreate);

  const { rows: dbMigrations } = await db.execute<{
    id: number;
    hash: string;
    created_at: string;
  }>(
    sql`select id, hash, created_at from "__drizzle_migrations" order by created_at desc limit 1`
  );

  const lastDbMigration = dbMigrations[0];
  await db.transaction(async (tx) => {
    for await (const migration of migrations) {
      if (
        !lastDbMigration ||
        Number(lastDbMigration.created_at) < migration.folderMillis
      ) {
        for (const stmt of migration.sql) {
          await tx.execute(sql.raw(stmt));
        }
        await tx.execute(
          sql`insert into "__drizzle_migrations" ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`
        );
      }
    }
  });
};

export async function migrate(
  db: NodePgDatabase,
  config: string | MigrationConfig
) {
  const migrations = readMigrationFiles(config);
  await patchedMigrate(migrations, db);
}
