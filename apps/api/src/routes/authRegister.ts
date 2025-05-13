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
import {
  badRequestSchema,
  ConflictError,
  conflictSchema,
} from "http-errors-enhanced";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const plugin: FastifyPluginAsyncZodOpenApi = async (fastify, _opts) => {
  fastify.route({
    method: "POST",
    url: "/auth/register",
    schema: {
      tags: ["auth"],
      description: "Register a new user",
      body: z.object({
        username: z.string().toLowerCase(),
        email: z.string().email(),
        password: z.string(),
      }),
      response: {
        200: zodToJsonSchema(AuthSchema),
        400: badRequestSchema,
        409: conflictSchema,
      },
    } satisfies FastifyZodOpenApiSchema,

    handler: async function (request, _reply) {
      const { username, email, password } = request.body;

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

      // TODO: if a duplicate username exists, just append a shortId to the end
      // and let the user change it later
      if (existingUser) {
        const field =
          existingUser.username.toLowerCase() === username.toLowerCase()
            ? "username"
            : "email";
        throw new ConflictError("User already exists.");
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
    },
  });
};

export default plugin;
