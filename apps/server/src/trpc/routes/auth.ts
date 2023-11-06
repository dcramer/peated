import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { authedProcedure } from "..";

export default authedProcedure.query(async function ({ ctx }) {
  // this would be a good place to add refreshTokens (swap to POST for that)
  const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
  if (!user) {
    logError(`Authenticated user (${ctx.user.id}) failed to retrieve details`);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  if (!user.active) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  return { user: await serialize(UserSerializer, user, user) };
});
