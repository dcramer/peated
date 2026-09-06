import { db } from "@peated/server/db";
import { bottles, bottleTombstones } from "@peated/server/db/schema";
import { logInfo } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, asc, eq, gt, isNotNull, notExists } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";

const PAGE_SIZE = 250;

export const RepairBottleStatsJobArgsSchema = z
  .object({
    afterBottleId: z.number().int().positive().optional(),
  })
  .strict();

/** Queues bounded, resumable recomputations for every active Bottle. */
export default async function repairBottleStatsJob(input: JobPayload) {
  const { afterBottleId } = RepairBottleStatsJobArgsSchema.parse(input);
  const page = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(
      and(
        isNotNull(bottles.groupId),
        afterBottleId ? gt(bottles.id, afterBottleId) : undefined,
        notExists(
          db
            .select({ bottleId: bottleTombstones.bottleId })
            .from(bottleTombstones)
            .where(eq(bottleTombstones.bottleId, bottles.id)),
        ),
      ),
    )
    .orderBy(asc(bottles.id))
    .limit(PAGE_SIZE);

  for (let offset = 0; offset < page.length; offset += 50) {
    await Promise.all(
      page
        .slice(offset, offset + 50)
        .map(({ id }) =>
          pushUniqueJob(
            "UpdateBottleStats",
            { bottleId: id },
            { delay: 0, removeOnComplete: true, removeOnFail: false },
          ),
        ),
    );
  }

  const lastBottleId = page.at(-1)?.id ?? null;
  if (page.length === PAGE_SIZE && lastBottleId) {
    await pushUniqueJob(
      "RepairBottleStats",
      { afterBottleId: lastBottleId },
      { delay: 0, removeOnComplete: true, removeOnFail: false },
    );
  }

  logInfo("Queued Bottle statistics repair page", {
    extra: {
      afterBottleId: afterBottleId ?? null,
      lastBottleId,
      pageSize: page.length,
    },
  });

  return { lastBottleId, queuedCount: page.length };
}
