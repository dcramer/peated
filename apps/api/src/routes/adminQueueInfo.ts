import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAdmin } from "@peated/api/middleware/auth";
import { getQueue } from "@peated/api/worker/client";
import { forbiddenSchema } from "http-errors-enhanced";
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
              stats: z.object({
                wait: z.number(),
                active: z.number(),
                completed: z.number(),
                failed: z.number(),
              }),
            }),
          },
        },
        description: "Get queue statistics",
      },
      403: forbiddenSchema,
    },
    middleware: [requireAdmin],
  },
  async function (c) {
    const queue = await getQueue("default");
    const stats = await queue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
    );

    return c.json({ stats });
  },
);
