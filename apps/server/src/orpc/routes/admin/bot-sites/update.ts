import { db } from "@peated/server/db";
import { botSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BotSiteSchema, BotSiteUpdateSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BotSiteSerializer } from "@peated/server/serializers/botSite";
import { and, eq, isNull } from "drizzle-orm";

export default procedure
  .use(requireAdmin)
  .route({
    method: "PATCH",
    path: "/admin/bot-sites",
    summary: "Update website access",
    description:
      "Set or remove a website's robots.txt exception, or clear its blocked mark. Requires administrator privileges.",
    operationId: "updateBotSite",
  })
  .input(BotSiteUpdateSchema)
  .output(BotSiteSchema)
  .handler(async ({ input, context }) => {
    const now = new Date();
    // Blocked websites policy: only an admin sets a robots.txt exception, for
    // one website, and the row records the reason, who, and when.
    const changes: Partial<typeof botSites.$inferInsert> = { updatedAt: now };
    if (input.robotsException === null) {
      changes.robotsExceptionReason = null;
      changes.robotsExceptionById = null;
      changes.robotsExceptionAt = null;
    } else if (input.robotsException) {
      changes.robotsExceptionReason = input.robotsException.reason;
      changes.robotsExceptionById = context.user.id;
      changes.robotsExceptionAt = now;
    }
    if (input.blocked === false) changes.blockedAt = null;

    const site = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(botSites)
        .values({ origin: input.origin, createdAt: now, ...changes })
        .onConflictDoUpdate({ target: botSites.origin, set: changes })
        .returning();
      // A website with no exception and no block needs no row.
      await tx
        .delete(botSites)
        .where(
          and(
            eq(botSites.origin, input.origin),
            isNull(botSites.blockedAt),
            isNull(botSites.robotsExceptionReason),
          ),
        );
      return row;
    });

    return await serialize(BotSiteSerializer, site, context.user);
  });
