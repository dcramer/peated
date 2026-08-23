import { db } from "@peated/server/db";
import { externalSiteRuns } from "@peated/server/db/schema";
import { createScraperLifecycle } from "@peated/server/scraper/lifecycle";
import { scraperRegistry } from "@peated/server/scraper/registry";
import { asc } from "drizzle-orm";
import { vi } from "vitest";
import { scheduleScrapers } from "./scheduleScrapers";

test("skips disabled targets and schedules other due scrapers", async ({
  fixtures,
}) => {
  const disabledSite = await fixtures.ExternalSite({
    type: "totalwine",
    runEvery: 60,
    nextRunAt: null,
  });
  const enabledSite = await fixtures.ExternalSite({
    type: "decadentdrinks",
    runEvery: 60,
    nextRunAt: null,
  });
  const enqueue = vi.fn(async () => undefined);

  await scheduleScrapers(
    createScraperLifecycle({ registry: scraperRegistry, enqueue }),
  );

  const runs = await db
    .select()
    .from(externalSiteRuns)
    .orderBy(asc(externalSiteRuns.id));
  expect(runs).toHaveLength(1);
  expect(runs[0]).toMatchObject({
    externalSiteId: enabledSite.id,
    status: "queued",
    trigger: "scheduled",
  });
  expect(runs[0]?.externalSiteId).not.toBe(disabledSite.id);
  expect(enqueue).toHaveBeenCalledOnce();
});
