import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/repair-bottle-counts",
    summary: "Repair brand and producer bottle counts",
    description:
      "Check saved bottle totals for brands and producers, and fix any that are wrong. Requires administrator privileges.",
    operationId: "repairEntityBottleCounts",
  })
  .input(z.object({}).strict().default({}))
  .output(z.object({ status: z.literal("queued") }).strict())
  .handler(async () => {
    await pushUniqueJob(
      "RepairEntityBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    return { status: "queued" };
  });
