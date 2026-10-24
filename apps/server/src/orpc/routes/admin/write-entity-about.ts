import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { ENTITY_ABOUT_WRITER_READY } from "@peated/server/worker/jobs/writeEntityAbout";
import { asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/write-entity-about",
    summary: "Queue About pages",
    description:
      "Queue the About writer for one entity, or for a batch of distilleries and brands ordered by public activity. Pages that pass every check publish without review. Fails while the writer is turned off. Requires administrator privileges.",
    operationId: "writeEntityAbout",
  })
  .input(
    z
      .object({
        entity: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Queue only this entity"),
        offset: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Skip this many entities in activity order"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(50)
          .describe("Number of entities to queue"),
      })
      .strict(),
  )
  .output(z.object({ queued: z.array(z.number()) }))
  .handler(async ({ input, errors }) => {
    if (!ENTITY_ABOUT_WRITER_READY) {
      throw errors.BAD_REQUEST({
        message:
          "The About writer is turned off or missing its model or web search key.",
      });
    }
    const ids = input.entity
      ? [input.entity]
      : (
          await db
            .select({ id: entities.id })
            .from(entities)
            .where(inArray(entities.kind, ["distillery", "brand"]))
            .orderBy(
              desc(entities.publicReviewAndTastingCount),
              asc(entities.id),
            )
            .offset(input.offset)
            .limit(input.limit)
        ).map((row) => row.id);

    await Promise.all(
      ids.map((entityId) => pushUniqueJob("WriteEntityAbout", { entityId })),
    );
    return { queued: ids };
  });
