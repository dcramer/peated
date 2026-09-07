import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/rebuild-summaries",
    summary: "Rebuild saved catalog summaries",
    description:
      "Rebuild saved Bottle ratings, flavor notes, and catalog totals. Requires administrator privileges.",
    operationId: "rebuildCatalogSummaries",
  })
  .input(z.object({}).strict().default({}))
  .output(z.object({ status: z.literal("queued") }).strict())
  .handler(async () => {
    await pushUniqueJob(
      "RepairBottleStats",
      {},
      {
        delay: 0,
      },
    );
    await pushUniqueJob(
      "RepairEntityBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    await pushUniqueJob(
      "RepairLocationBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    await pushUniqueJob(
      "RepairBottleGroupBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    await pushUniqueJob(
      "RepairBottleSeriesReleaseCounts",
      {},
      {
        delay: 0,
      },
    );
    await pushUniqueJob(
      "RepairCollectionBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    return { status: "queued" };
  });
