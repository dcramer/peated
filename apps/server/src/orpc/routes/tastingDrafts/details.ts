import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import {
  TastingDraftIdInputSchema,
  TastingDraftSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingDraftSerializer } from "@peated/server/serializers/tastingDraft";
import { and, eq } from "drizzle-orm";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/tasting-drafts/{draft}",
    summary: "Get tasting draft",
    description:
      "Get one of your own tasting drafts. Another member's draft returns not found.",
    operationId: "getTastingDraft",
  })
  .input(TastingDraftIdInputSchema)
  .output(TastingDraftSchema)
  .handler(async ({ input, context, errors }) => {
    const [draft] = await db
      .select()
      .from(tastingDrafts)
      .where(
        and(
          eq(tastingDrafts.id, input.draft),
          eq(tastingDrafts.createdById, context.user.id),
        ),
      );
    if (!draft) {
      throw errors.NOT_FOUND({ message: "Draft not found." });
    }

    return await serialize(TastingDraftSerializer, draft, context.user);
  });
