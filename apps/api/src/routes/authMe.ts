import { requestContext } from "@fastify/request-context";
import { UserSchema } from "@peated/api/schemas";
import { serialize } from "@peated/api/serializers";
import { UserSerializer } from "@peated/api/serializers/user";
import type {
  FastifyPluginAsyncZodOpenApi,
  FastifyZodOpenApiSchema,
} from "fastify-zod-openapi";
import { UnauthorizedError, unauthorizedSchema } from "http-errors-enhanced";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { requireAuth } from "../middleware/auth";

const plugin: FastifyPluginAsyncZodOpenApi = async (fastify, _opts) => {
  fastify.route({
    method: "GET",
    url: "/auth/me",
    schema: {
      tags: ["auth"],
      response: {
        200: zodToJsonSchema(z.object({ user: UserSchema })),
        401: unauthorizedSchema,
      },
    } satisfies FastifyZodOpenApiSchema,
    preHandler: [requireAuth],
    handler: async function (_request, _reply) {
      const currentUser = requestContext.get("user");
      if (!currentUser) {
        throw new UnauthorizedError();
      }

      return {
        user: await serialize(UserSerializer, currentUser, currentUser),
      };
    },
  });
};

export default plugin;
