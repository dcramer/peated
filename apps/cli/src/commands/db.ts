import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { migrate } from "@peated/server/db/migrate";

const subcommand = program.command("db");

subcommand
  .command("migrate")
  .description("Run drizzle-kit database migrations")
  .option("--fake", "fake the migration, only writing metadata to the db")
  .action(async (options) => {
    await migrate({
      db,
      fake: options.fake,
    });
  });
