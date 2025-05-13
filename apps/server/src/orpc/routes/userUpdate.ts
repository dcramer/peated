import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { getUserFromId } from "@peated/server/lib/api";
import { generatePasswordHash } from "@peated/server/lib/auth";
import { UserInputSchema, UserSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireAuth } from "../middleware";

export default procedure
  .use(requireAuth)
  .route({ method: "PATCH", path: "/users/:user" })
  .input(
    UserInputSchema.partial().extend({
      user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
    }),
  )
  .output(UserSchema)
  .handler(async function ({ input, context }) {
    const user = await getUserFromId(db, input.user, context.user);

    if (!user) {
      throw new ORPCError("NOT_FOUND", {
        message: "User not found.",
      });
    }

    if (user.id !== context.user.id && !context.user.admin) {
      throw new ORPCError("FORBIDDEN", {
        message: "Cannot edit another user.",
      });
    }

    const data: { [name: string]: any } = {};

    if (input.username !== undefined && input.username !== user.username) {
      data.username = input.username;
      if (data.username === "me") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid username.",
        });
      }
    }

    if (input.private !== undefined && input.private !== user.private) {
      data.private = input.private;
    }

    if (input.admin !== undefined && input.admin !== user.admin) {
      if (!context.user.admin) {
        throw new ORPCError("FORBIDDEN", {
          message: "Admin privileges required to modify admin status.",
        });
      }
      data.admin = input.admin;
    }

    if (input.mod !== undefined && input.mod !== user.mod) {
      if (!context.user.admin) {
        throw new ORPCError("FORBIDDEN", {
          message: "Admin privileges required to modify mod status.",
        });
      }
      data.mod = input.mod;
    }

    if (input.password) {
      const passwordHash = generatePasswordHash(input.password);
      if (passwordHash !== user.passwordHash) data.passwordHash = passwordHash;
    }

    if (!Object.values(data).length) {
      return await serialize(UserSerializer, user, context.user);
    }

    try {
      const [newUser] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, user.id))
        .returning();
      if (!newUser) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Unable to update user.",
        });
      }

      return await serialize(UserSerializer, newUser, context.user);
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint === "user_username_unq") {
        throw new ORPCError("CONFLICT", {
          message: "Username in use.",
          cause: err,
        });
      }
      throw err;
    }
  });
