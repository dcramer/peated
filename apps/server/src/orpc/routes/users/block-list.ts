import { db } from "@peated/server/db";
import { userBlocks, users } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { CursorSchema, UserBlockSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/users/{user}/blocks",
    summary: "List blocked members",
    description:
      "List the members you have blocked, newest first. Only your own list is available.",
    operationId: "listBlockedUsers",
  })
  .input(
    z.object({
      user: z.union([z.coerce.number(), z.literal("me"), z.string()]),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(UserBlockSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({ message: "User not found." });
    }
    if (user.id !== context.user.id) {
      throw errors.FORBIDDEN({
        message: "You can only view your own blocked members.",
      });
    }

    const { cursor, limit } = input;
    const offset = (cursor - 1) * limit;
    const rows = await db
      .select({ block: userBlocks, user: users })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedUserId))
      .where(eq(userBlocks.userId, context.user.id))
      .orderBy(desc(userBlocks.createdAt), desc(userBlocks.id))
      .limit(limit + 1)
      .offset(offset);

    const page = rows.slice(0, limit);
    const serializedUsers = await serialize(
      UserSerializer,
      page.map(({ user }) => user),
      context.user,
    );

    return {
      results: page.map(({ block }, index) => ({
        user: serializedUsers[index],
        createdAt: block.createdAt.toISOString(),
      })),
      rel: {
        nextCursor: rows.length > limit ? cursor + 1 : null,
        prevCursor: cursor > 1 ? cursor - 1 : null,
      },
    };
  });
