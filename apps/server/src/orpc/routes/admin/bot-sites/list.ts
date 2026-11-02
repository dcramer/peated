import { db } from "@peated/server/db";
import { botSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BotSiteSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BotSiteSerializer } from "@peated/server/serializers/botSite";
import { asc, isNotNull, or } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/bot-sites",
    summary: "List website access",
    description:
      "List websites PeatedBot treats specially: ones blocked after a bot wall, and ones with a robots.txt exception. Requires administrator privileges.",
    operationId: "listBotSites",
  })
  .input(z.object({}))
  .output(listResponse(BotSiteSchema))
  .handler(async ({ context }) => {
    const results = await db
      .select()
      .from(botSites)
      .where(
        or(
          isNotNull(botSites.blockedAt),
          isNotNull(botSites.robotsExceptionReason),
        ),
      )
      .orderBy(asc(botSites.origin));

    return {
      results: await serialize(BotSiteSerializer, results, context.user),
      rel: { nextCursor: null, prevCursor: null },
    };
  });
