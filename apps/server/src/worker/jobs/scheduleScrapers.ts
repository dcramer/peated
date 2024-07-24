import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { getJobForSite } from "../utils";

export default async function scheduleScrapers() {
  const pending = await db
    .select()
    .from(externalSites)
    .where(
      and(
        or(
          isNull(externalSites.nextRunAt),
          lte(externalSites.nextRunAt, sql`NOW()`),
        ),
        isNotNull(externalSites.runEvery),
      ),
    );

  await db.transaction(async (tx) => {
    for (const site of pending) {
      await pushJob(getJobForSite(site.type));
      // TODO: have the job update nextRunAt when it finishes
      await tx
        .update(externalSites)
        .set({
          lastRunAt: sql`NOW()`,
          nextRunAt: sql`NOW() + INTERVAL '${sql.raw(
            `${site.runEvery} minutes`,
          )}'`,
        })
        .where(eq(externalSites.id, site.id));
    }
  });
}
