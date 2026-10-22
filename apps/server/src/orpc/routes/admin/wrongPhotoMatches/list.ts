import { db } from "@peated/server/db";
import { wrongPhotoMatches } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { CursorSchema, WrongPhotoMatchSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { WrongPhotoMatchSerializer } from "@peated/server/serializers/wrongPhotoMatch";
import { desc } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/wrong-photo-matches",
    summary: "List wrong photo matches",
    description:
      "List photo matches that members said were the wrong Bottle, newest first, with the label photo, the label facts read from it, and the Bottle the member chose next. Requires an administrator.",
    operationId: "listWrongPhotoMatches",
  })
  .input(
    z.object({
      cursor: z.coerce
        .number()
        .gte(1)
        .default(1)
        .describe("Page number to return"),
      limit: z.coerce
        .number()
        .gte(1)
        .lte(100)
        .default(25)
        .describe("Records per page"),
    }),
  )
  .output(
    z.object({
      results: z.array(WrongPhotoMatchSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    const { cursor, limit } = input;
    const offset = (cursor - 1) * limit;

    const rows = await db
      .select()
      .from(wrongPhotoMatches)
      .orderBy(desc(wrongPhotoMatches.createdAt), desc(wrongPhotoMatches.id))
      .limit(limit + 1)
      .offset(offset);

    return {
      results: await serialize(
        WrongPhotoMatchSerializer,
        rows.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: rows.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
