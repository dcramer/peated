import { db } from "@peated/api/db";
import { users } from "@peated/api/db/schema/users";
import { sendPasswordResetEmail } from "@peated/api/lib/email";
import { eq, sql } from "drizzle-orm";
import type {
  FastifyPluginAsyncZodOpenApi,
  FastifyZodOpenApiSchema,
} from "fastify-zod-openapi";
import {
  badRequestSchema,
  NotFoundError,
  notFoundSchema,
} from "http-errors-enhanced";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const plugin: FastifyPluginAsyncZodOpenApi = async (fastify, _opts) => {
  fastify.route({
    method: "POST",
    url: "/auth/password-reset",
    schema: {
      tags: ["auth"],
      body: z.object({
        email: z.string().email(),
      }),
      response: {
        200: zodToJsonSchema(z.object({})),
        400: badRequestSchema,
        404: notFoundSchema,
      },
    } satisfies FastifyZodOpenApiSchema,
    handler: async function (request, _reply) {
      const { email } = request.body;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));
      if (!user || !user.active) {
        throw new NotFoundError("Account not found.");
      }
      await sendPasswordResetEmail({ user });
      return {};
    },
  });
};

export default plugin;
