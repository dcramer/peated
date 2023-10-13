import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { DatabaseType } from ".";

export const migrate = async function ({
  db,
  fake = false,
  migrationsFolder = __dirname + "/../migrations",
}: {
  db: DatabaseType;
  fake?: boolean;
  migrationsFolder?: string;
}) {
  const migrations = readMigrationFiles({
    migrationsFolder,
  });
  console.log(
    `Found ${migrations.length} total migrations in ${migrationsFolder}`,
  );

  const migrationTableCreate = sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await db.execute(migrationTableCreate);

  const {
    rows: [lastDbMigration],
  } = await db.execute<{
    id: number;
    hash: string;
    created_at: string;
  }>(
    sql`select id, hash, created_at from "__drizzle_migrations" order by created_at desc limit 1`,
  );

  const migrationsToApply = migrations.filter(
    (m) =>
      !lastDbMigration || Number(lastDbMigration.created_at) < m.folderMillis,
  );
  if (migrationsToApply.length === 0) {
    console.log("No migrations need applied.");
    return;
  }

  console.log(
    `Migrating to ${migrationsToApply[migrationsToApply.length - 1].hash} (${
      migrationsToApply.length
    } to apply)`,
  );

  for await (const migration of migrationsToApply) {
    await db.transaction(async (tx) => {
      if (
        !lastDbMigration ||
        Number(lastDbMigration.created_at) < migration.folderMillis
      ) {
        if (fake) {
          console.log(`Faking migration ${migration.hash}`);
        } else {
          console.log(
            `Applying migration ${migration.hash} (${migration.sql.length} statement(s))`,
          );
          for (const stmt of migration.sql) {
            await tx.execute(sql.raw(stmt));
          }
        }
        await tx.execute(
          sql`insert into "__drizzle_migrations" ("hash", "created_at") values(${migration.hash}, ${migration.folderMillis})`,
        );
      }
    });
  }
};
