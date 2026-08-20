import { db } from "@peated/server/db";
import { externalSiteRuns } from "@peated/server/db/schema";
import { pushJob } from "@peated/server/worker/client";
import { asc } from "drizzle-orm";
import scheduleScrapers from "./scheduleScrapers";

vi.mock("@peated/server/worker/client");

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

  await scheduleScrapers();

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
  expect(pushJob).toHaveBeenCalledOnce();
});
