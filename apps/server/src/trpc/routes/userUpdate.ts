import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { UserInputSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";

export default authedProcedure
  .input(
    UserInputSchema.partial().extend({
      user: z.union([z.literal("me"), z.number(), z.string()]),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    const user = await getUserFromId(db, input.user, ctx.user);

    if (!user) {
      throw new TRPCError({
        message: "User not found.",
        code: "NOT_FOUND",
      });
    }

    if (user.id !== ctx.user.id && !ctx.user.admin) {
      throw new TRPCError({
        message: "Cannot edit another user.",
        code: "FORBIDDEN",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.username !== undefined && input.username !== user.username) {
      data.username = input.username;
      if (data.username === "me") {
        throw new TRPCError({
          message: "Invalid username.",
          code: "BAD_REQUEST",
        });
      }
    }

    if (input.private !== undefined && input.private !== user.private) {
      data.private = input.private;
    }

    if (input.admin !== undefined && input.admin !== user.admin) {
      if (!ctx.user.admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
        });
      }
      data.admin = input.admin;
    }

    if (input.mod !== undefined && input.mod !== user.mod) {
      if (!ctx.user.admin) {
        throw new TRPCError({
          code: "FORBIDDEN",
        });
      }
      data.mod = input.mod;
    }

    if (!Object.values(data).length) {
      return await serialize(UserSerializer, user, ctx.user);
    }

    try {
      const [newUser] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, user.id))
        .returning();
      if (!newUser) {
        throw new TRPCError({
          message: "Unable to update user.",
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      return await serialize(UserSerializer, newUser, ctx.user);
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "user_username_unq") {
        throw new TRPCError({
          message: "Username in use.",
          code: "CONFLICT",
          cause: err,
        });
      }
      throw err;
    }
  });
