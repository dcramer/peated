import { ORPCError, os } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { requireAuth } from "@peated/server/orpc/middleware";
import { UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .use(requireAuth)
  .output(z.object({ user: UserSchema }))
  .handler(async function ({ context }) {
    // this would be a good place to add refreshTokens (swap to POST for that)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, context.user.id));
    if (!user) {
      logError(
        `Authenticated user (${context.user.id}) failed to retrieve details`,
      );
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    if (!user.active) {
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    return { user: await serialize(UserSerializer, user, user) };
  });
