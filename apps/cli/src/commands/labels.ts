import program from "@peated/cli/program";
import { listUnmatchedBottleAliasNames } from "@peated/server/lib/bottleAliases";

const subcommand = program.command("labels");

subcommand.command("dump-unmatched").action(async () => {
  const step = 1000;

  let hasResults = true;
  let offset = 0;
  while (hasResults) {
    hasResults = false;
    const names = await listUnmatchedBottleAliasNames({ limit: step, offset });
    for (const name of names) {
      process.stdout.write(`${name}\n`);
      hasResults = true;
    }
    offset += step;
  }
});
