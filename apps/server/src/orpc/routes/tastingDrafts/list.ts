import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import tastingDraftListContract from "@peated/server/orpc/contracts/tastingDrafts/list";
import { requireAuth } from "@peated/server/orpc/middleware";
import { serialize } from "@peated/server/serializers";
import { TastingDraftSerializer } from "@peated/server/serializers/tastingDraft";
import { desc, eq } from "drizzle-orm";

export default implement(tastingDraftListContract)
  .use(requireAuth)
  .handler(async ({ input, context }) => {
    const { cursor, limit } = input;
    const offset = (cursor - 1) * limit;

    const rows = await db
      .select()
      .from(tastingDrafts)
      .where(eq(tastingDrafts.createdById, context.user.id))
      .orderBy(desc(tastingDrafts.updatedAt), desc(tastingDrafts.id))
      .limit(limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        TastingDraftSerializer,
        rows.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: rows.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
