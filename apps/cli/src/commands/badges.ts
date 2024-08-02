import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { rescanBadge } from "@peated/server/lib/badges";
import { eq } from "drizzle-orm";

const subcommand = program.command("badges");

subcommand
  .command("rescan")
  .description("Rescan a badge to fill in missing XP.")
  .argument("[badgeId]")
  .action(async (badgeId, options) => {
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId));
    if (!badge) {
      throw new Error("Unknown badge");
    }

    await rescanBadge(badge);
  });
