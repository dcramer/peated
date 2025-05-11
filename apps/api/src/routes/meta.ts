import { OpenAPIHono } from "@hono/zod-openapi";
import config from "@peated/api/config";
import { z } from "zod";

export default new OpenAPIHono().openapi(
  {
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              version: z.string(),
            }),
          },
        },
        description: "Information about the version of the API",
      },
    },
  },
  async function (c) {
    return c.json({
      version: config.VERSION,
    });
  },
);
