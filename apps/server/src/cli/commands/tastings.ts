import { db } from "@peated/server/db";
import { pushJob } from "@peated/server/jobs";
import program from "src/cli/program";

const subcommand = program.command("tastings");

subcommand
  .command("notify-discord")
  .description("Manually fire Discord notification")
  .argument("[tastingId]")
  .action(async (tastingId, options) => {
    const tastingQuery = await db.query.tastings.findMany({
      where: (tastings, { eq }) => eq(tastings.id, tastingId),
    });
    for (const tasting of tastingQuery) {
      console.log(`Firing notification for tasting ${tasting.id}.`);
      await pushJob("NotifyDiscordOnTasting", { tastingId: tasting.id });
    }
  });
