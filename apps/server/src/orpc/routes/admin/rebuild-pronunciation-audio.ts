import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getPronunciationAudioUrl } from "@peated/server/lib/entityPronunciationAudio";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, asc, gt, isNotNull, or } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/rebuild-pronunciation-audio",
    summary: "Queue missing pronunciation audio",
    description:
      "Check a page of Entities by ID and queue an audio job for each one whose pronunciation audio is missing, made from older IPA or another voice, or left after its IPA was cleared. Continue with `nextAfterId` until it is null. Requires administrator privileges.",
    operationId: "rebuildPronunciationAudio",
  })
  .input(
    z
      .object({
        afterId: z
          .number()
          .int()
          .nonnegative()
          .default(0)
          .describe("Check Entities with IDs greater than this value"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(500)
          .describe("Number of Entities to check"),
      })
      .strict(),
  )
  .output(z.object({ queued: z.number(), nextAfterId: z.number().nullable() }))
  .handler(async ({ input }) => {
    const rows = await db
      .select({
        id: entities.id,
        pronunciationIpa: entities.pronunciationIpa,
        pronunciationAudioUrl: entities.pronunciationAudioUrl,
      })
      .from(entities)
      .where(
        and(
          gt(entities.id, input.afterId),
          or(
            isNotNull(entities.pronunciationIpa),
            isNotNull(entities.pronunciationAudioUrl),
          ),
        ),
      )
      .orderBy(asc(entities.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);

    // Repair path: audio jobs live only in Redis, so this compares each
    // stored URL with the one the current IPA and voice would produce.
    const stale = page.filter(
      (row) =>
        row.pronunciationAudioUrl !==
        (row.pronunciationIpa
          ? getPronunciationAudioUrl(row.id, row.pronunciationIpa)
          : null),
    );
    for (const row of stale) {
      await pushUniqueJob(
        "GenerateEntityPronunciationAudio",
        { entityId: row.id },
        { delay: 0 },
      );
    }
    return {
      queued: stale.length,
      nextAfterId: rows.length > input.limit ? page.at(-1)!.id : null,
    };
  });
