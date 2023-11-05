import { db } from "@peated/shared/db";
import pushJob, { shutdownClient } from "@peated/shared/jobs";
import { program } from "commander";

program.name("tastings").description("CLI for assisting with tasting admin");

program
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

    await shutdownClient();
  });

program.parseAsync();
