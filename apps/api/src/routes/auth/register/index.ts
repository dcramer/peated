import { db } from "@peated/api/db";
import { users } from "@peated/api/db/schema";
import {
  createAccessToken,
  createUser,
  generatePasswordHash,
} from "@peated/api/lib/auth";
import { AuthSchema } from "@peated/api/schemas/auth";
import { serialize } from "@peated/api/serializers";
import { UserSerializer } from "@peated/api/serializers/user";
import { eq, or, sql } from "drizzle-orm";
import type {
  FastifyPluginAsyncZodOpenApi,
  FastifyZodOpenApiSchema,
} from "fastify-zod-openapi";
import { ConflictError, conflictSchema } from "http-errors-enhanced";
import { z } from "zod";

const plugin: FastifyPluginAsyncZodOpenApi = async (fastify, _opts) => {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["auth"],
        description: "Register a new user",
        body: z.object({
          username: z.string().toLowerCase(),
          email: z.string().email(),
          password: z.string(),
        }),
        response: {
          200: AuthSchema,
          409: conflictSchema,
        },
      } satisfies FastifyZodOpenApiSchema,
    },
    async function (request, _reply) {
      const { username, email, password } = request.body;

      try {
        // Check for existing user with same username or email
        const [existingUser] = await db
          .select()
          .from(users)
          .where(
            or(
              eq(sql`LOWER(${users.username})`, username.toLowerCase()),
              eq(sql`LOWER(${users.email})`, email.toLowerCase()),
            ),
          );

        if (existingUser) {
          const field =
            existingUser.username.toLowerCase() === username.toLowerCase()
              ? "username"
              : "email";
          throw new ConflictError("User already exists", { field });
        }

        const user = await createUser(db, {
          username,
          email,
          passwordHash: generatePasswordHash(password),
        });

        return {
          user: await serialize(UserSerializer, user, user),
          accessToken: await createAccessToken(user),
        };
      } catch (err) {
        if (err instanceof ConflictError) {
          throw err;
        }
        throw err;
      }
    },
  );
};

export default plugin;
