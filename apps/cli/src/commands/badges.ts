import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { badgeAwards, badges } from "@peated/server/db/schema";
import { rescanBadge } from "@peated/server/lib/badges";
import { getFormula } from "@peated/server/lib/badges/formula";
import { and, eq } from "drizzle-orm";

const subcommand = program.command("badges");

subcommand
  .command("rescan")
  .description("Rescan a badge to fill in missing XP.")
  .argument("<badgeId>")
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

subcommand
  .command("fix-levels")
  .description("Recalculate all levels.")
  .argument("[badgeId]")
  .action(async (badgeId, options) => {
    const awardQuery = await db.query.badgeAwards.findMany({
      with: {
        badge: true,
      },
      where: badgeId ? eq(badgeAwards.badgeId, badgeId) : undefined,
    });

    for (const award of awardQuery) {
      const formula = getFormula(award.badge.formula);
      const level = formula(award.xp, award.badge.maxLevel) ?? award.level;
      if (award.level !== level) {
        console.log(
          `Updating level on award ${award.id} from ${award.level} to ${level}`
        );
        await db
          .update(badgeAwards)
          .set({ level })
          .where(
            and(eq(badgeAwards.id, award.id), eq(badgeAwards.xp, award.xp))
          );
      }
    }
  });
