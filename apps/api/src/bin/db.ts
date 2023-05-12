import { program } from "commander";
import { db } from "../db";
import { migrate } from "../db/migrate";

program.name("db").description("CLI for assisting with Drizzle");

program
  .command("migrate")
  .description("Run drizzle-kit database migrations")
  .option("--fake", "fake the migration, only writing metadata to the db")
  .action(async (options) => {
    await migrate({
      db,
      fake: options.fake,
    });
  });

program.parseAsync();
