import config from "@peated/server/config";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export default {
  method: "GET",
  url: "/",
  schema: {
    response: {
      200: zodToJsonSchema(
        z.object({
          version: z.string(),
        }),
      ),
    },
  },
  handler: async (req, res) => {
    res.send({
      version: config.VERSION,
    });
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
