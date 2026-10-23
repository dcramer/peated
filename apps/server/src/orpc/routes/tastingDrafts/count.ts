import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import tastingDraftCountContract from "@peated/server/orpc/contracts/tastingDrafts/count";
import { requireAuth } from "@peated/server/orpc/middleware";
import { count, eq } from "drizzle-orm";

export default implement(tastingDraftCountContract)
  .use(requireAuth)
  .handler(async ({ context }) => {
    const [{ total }] = await db
      .select({ total: count() })
      .from(tastingDrafts)
      .where(eq(tastingDrafts.createdById, context.user.id));

    return { count: total };
  });
