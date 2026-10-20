import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { count, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/tasting-drafts/count",
    summary: "Count tasting drafts",
    description: "Count your own tasting drafts.",
    operationId: "countTastingDrafts",
  })
  .output(z.object({ count: z.number().int() }))
  .handler(async ({ context }) => {
    const [{ total }] = await db
      .select({ total: count() })
      .from(tastingDrafts)
      .where(eq(tastingDrafts.createdById, context.user.id));

    return { count: total };
  });
