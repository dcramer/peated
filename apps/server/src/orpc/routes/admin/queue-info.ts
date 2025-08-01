import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { getQueue } from "@peated/server/worker/client";
import { z } from "zod";

const QueueInfoSchema = z.object({
  stats: z.object({
    wait: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
  }),
});

type QueueInfoType = z.infer<typeof QueueInfoSchema>;

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/queue/info",
    operationId: "getQueueInfo",
    summary: "Get queue information",
    description:
      "Retrieve job queue statistics including waiting, active, completed, and failed jobs. Requires admin privileges",
  })
  .output(QueueInfoSchema)
  .handler(async function () {
    const queue = await getQueue("default");
    const stats = await queue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
    );

    return {
      stats: {
        wait: stats.wait || 0,
        active: stats.active || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
      },
    } satisfies QueueInfoType;
  });
