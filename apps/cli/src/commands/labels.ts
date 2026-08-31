import program from "@peated/cli/program";
import { listUnmatchedBottleReferenceNames } from "@peated/server/lib/bottleReferences";

const subcommand = program.command("labels");

subcommand.command("dump-unmatched").action(async () => {
  const step = 1000;

  let hasResults = true;
  let offset = 0;
  while (hasResults) {
    hasResults = false;
    const names = await listUnmatchedBottleReferenceNames({
      limit: step,
      offset,
    });
    for (const name of names) {
      process.stdout.write(`${name}\n`);
      hasResults = true;
    }
    offset += step;
  }
});
