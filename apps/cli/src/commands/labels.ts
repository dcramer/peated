import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { and, asc, eq, getTableColumns, isNull } from "drizzle-orm";

const subcommand = program.command("labels");

subcommand.command("dump-unmatched").action(async (options) => {
  const step = 1000;

  const { embedding, ...columns } = getTableColumns(bottleAliases);
  const baseQuery = db
    .select(columns)
    .from(bottleAliases)
    .where(
      and(eq(bottleAliases.ignored, false), isNull(bottleAliases.bottleId))
    )
    .orderBy(asc(bottleAliases.name));

  let hasResults = true;
  let offset = 0;
  while (hasResults) {
    hasResults = false;
    const query = await baseQuery.offset(offset).limit(step);
    for (const item of query) {
      process.stdout.write(`${item.name}\n`);
      hasResults = true;
    }
    offset += step;
  }
});
