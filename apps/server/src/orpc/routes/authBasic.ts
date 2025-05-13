import { oc } from "@orpc/contract";
import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken } from "@peated/server/lib/auth";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { compareSync } from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

const authBasic = procedure
  .input(
    z.object({
      email: z.string(),
      password: z.string(),
    }),
  )
  .output(AuthSchema)
  .handler(async function ({ input }) {
    const { email, password }: { email: string; password: string } = input;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));
    if (!user) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid credentials.",
      });
    }

    if (!user.passwordHash) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid credentials.",
      });
    }

    if (!compareSync(password, user.passwordHash)) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid credentials.",
      });
    }

    if (!user.active) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid credentials.",
      });
    }

    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });

export const router = {
  authBasic,
};
