import config from "@peated/server/config";
import type {
  FastifyPluginAsyncZodOpenApi,
  FastifyZodOpenApiSchema,
} from "fastify-zod-openapi";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const plugin: FastifyPluginAsyncZodOpenApi = async (fastify, _opts) => {
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: zodToJsonSchema(
            z.object({
              version: z.string(),
            }),
          ),
        },
      } satisfies FastifyZodOpenApiSchema,
    },
    async function (_request, _reply) {
      return {
        version: config.VERSION,
      };
    },
  );
};

export default plugin;
