import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { ChangeSchema, CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ChangeSerializer } from "@peated/server/serializers/change";
import type { SQL } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/changes",
    summary: "List changes",
    spec: {
      operationId: "listChanges",
    },
    description:
      "Retrieve change history for bottles and entities with filtering by user and object type",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.coerce.number()]).optional(),
      type: z.enum(["bottle", "entity"]).optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(100),
    }),
  )
  .output(
    z.object({
      results: z.array(ChangeSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const { cursor, limit, ...rest } = input;
    const offset = (cursor - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [];

    if (rest.type) {
      where.push(eq(changes.objectType, rest.type));
    }
    if (rest.user) {
      if (rest.user === "me") {
        if (!context.user) {
          throw errors.UNAUTHORIZED();
        }

        where.push(eq(changes.createdById, context.user.id));
      } else {
        where.push(eq(changes.createdById, rest.user));
      }
    }

    const results = await db
      .select()
      .from(changes)
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(changes.id));

    return {
      results: await serialize(
        ChangeSerializer,
        results.slice(0, limit),
        context.user,
      ),
      rel: {
        nextCursor: results.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
