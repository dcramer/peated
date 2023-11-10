import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken } from "@peated/server/lib/auth";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { compareSync } from "bcrypt";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      email: z.string(),
      password: z.string(),
    }),
  )
  .mutation(async function ({ input: { email, password } }) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      console.log("user not found");
      throw new TRPCError({
        message: "Invalid credentials.",
        code: "UNAUTHORIZED",
      });
    }

    if (!user.passwordHash) {
      console.log("user has no password set");
      throw new TRPCError({
        message: "Invalid credentials.",
        code: "UNAUTHORIZED",
      });
    }

    if (!compareSync(password, user.passwordHash)) {
      console.log("invalid password");
      throw new TRPCError({
        message: "Invalid credentials.",
        code: "UNAUTHORIZED",
      });
    }

    if (!user.active) {
      throw new TRPCError({
        message: "Invalid credentials.",
        code: "UNAUTHORIZED",
      });
    }

    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });
