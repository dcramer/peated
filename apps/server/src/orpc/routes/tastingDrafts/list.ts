import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { CursorSchema, TastingDraftSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { TastingDraftSerializer } from "@peated/server/serializers/tastingDraft";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/tasting-drafts",
    summary: "List tasting drafts",
    description:
      "List your own tasting drafts, most recently saved first. Drafts are private to the member who saved them.",
    operationId: "listTastingDrafts",
  })
  .input(
    z.object({
      cursor: z.coerce
        .number()
        // int() also caps it at a safe integer, so the offset fits a bigint.
        .int()
        .gte(1)
        .default(1)
        .describe("Page number to return"),
      limit: z.coerce
        .number()
        .int()
        .gte(1)
        .lte(100)
        .default(25)
        .describe("Drafts per page"),
    }),
  )
  .output(
    z.object({
      results: z.array(TastingDraftSchema),
      rel: CursorSchema,
    }),
  )
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
