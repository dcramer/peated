import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { EntityAboutDocumentSchema } from "@peated/server/schemas/entityAbout";
import { pushJob } from "@peated/server/worker/dispatch";
import {
  draftEntityAbout,
  ENTITY_ABOUT_WRITER_READY,
} from "@peated/server/worker/jobs/writeEntityAbout";
import { asc, desc } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/write-entity-about",
    summary: "Queue About pages",
    description:
      "Queue the About writer for one entity, or for a batch of entities ordered by public activity. Pages that pass every check publish without review. With `dryRun`, write one entity's page now and return the checked page and its errors without saving; the request stays open for the whole run, which can take several minutes. Fails while the writer is turned off. Requires administrator privileges.",
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
        dryRun: z
          .boolean()
          .default(false)
          .describe(
            "Write `entity`'s page now and return it without saving or queueing",
          ),
      })
      .strict()
      .refine((input) => !input.dryRun || input.entity, {
        message: "A dry run needs `entity`.",
        path: ["entity"],
      }),
  )
  .output(
    z.object({
      queued: z.array(z.number()),
      draft: z
        .object({
          document: EntityAboutDocumentSchema,
          errors: z
            .array(z.string())
            .describe("Why the page would be rejected; empty when it passes"),
        })
        .nullable()
        .describe("The dry run's checked page; null when queueing"),
    }),
  )
  .handler(async ({ input, errors }) => {
    if (!ENTITY_ABOUT_WRITER_READY) {
      throw errors.BAD_REQUEST({
        message:
          "The About writer is turned off or missing its model or web search key.",
      });
    }
    if (input.dryRun && input.entity) {
      const draft = await draftEntityAbout({ entityId: input.entity });
      if (draft.status !== "checked") {
        throw errors.NOT_FOUND({ message: "Entity not found." });
      }
      return {
        queued: [],
        draft: { document: draft.document, errors: draft.errors },
      };
    }

    const ids = input.entity
      ? [input.entity]
      : (
          await db
            .select({ id: entities.id })
            .from(entities)
            .orderBy(
              desc(entities.publicReviewAndTastingCount),
              asc(entities.id),
            )
            .offset(input.offset)
            .limit(input.limit)
        ).map((row) => row.id);

    await Promise.all(
      ids.map((entityId) => pushJob("WriteEntityAbout", { entityId })),
    );
    return { queued: ids, draft: null };
  });
