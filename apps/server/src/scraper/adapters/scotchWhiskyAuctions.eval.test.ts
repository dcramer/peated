import { db } from "@peated/server/db";
import { auctionLots, externalSiteRuns } from "@peated/server/db/schema";
import { upsertAuctionObservation } from "@peated/server/lib/auctions";
import { requestAuctionLotDetails } from "@peated/server/scraper";
import { eq } from "drizzle-orm";
import { createScraperLifecycle } from "../lifecycle";
import { scraperRegistry as registeredScrapers } from "../registry";
import { executeScraperRun } from "../runs";
import { syncScraperDefinitions } from "../syncDefinitions";

const registry = {
  sources: new Map([
    [
      "scotchwhiskyauctions",
      registeredScrapers.sources.get("scotchwhiskyauctions")!,
    ],
  ]),
  targets: new Map([
    [
      "scotchwhiskyauctions",
      registeredScrapers.targets.get("scotchwhiskyauctions")!,
    ],
  ]),
};

// Explicit live checks stay separate from deterministic tests and never touch production data.
test("collects published Ardbeg cask facts through the real paced source runtime", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({
    type: "scotchwhiskyauctions",
    runEvery: null,
  });
  const name = "Ardbeg 2009 14 Year Old Single Cask #3771 Feis Ile 2024";
  const lots = [];
  for (const [auctionKey, auctionName, lotKey] of [
    ["232", "183rd", "893368"],
    ["205", "157th", "751232"],
  ]) {
    const auctionUrl = `https://www.scotchwhiskyauctions.com/auctions/${auctionKey}-the-${auctionName}-auction/`;
    const lot = (
      await upsertAuctionObservation(site.id, {
        auction: {
          sourceKey: auctionKey,
          name: `The ${auctionName} auction`,
          url: auctionUrl,
        },
        lot: {
          sourceKey: lotKey,
          name,
          url: `${auctionUrl}${lotKey}-ardbeg-2009-14-year-old-single-cask-3771-feis-ile-2024/`,
          state: "closed",
        },
        observedAt: new Date().toISOString(),
      })
    ).lot;
    await db
      .update(auctionLots)
      .set({ matchStatus: "review" })
      .where(eq(auctionLots.id, lot.id));
    await requestAuctionLotDetails(lot.id, lot.sourceFingerprint);
    lots.push(lot);
  }
  await syncScraperDefinitions(registry);
  const lifecycle = createScraperLifecycle({
    registry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  for (let attempt = 0; attempt < 6; attempt++) {
    const outcome = await executeScraperRun({ runId: run.id }, { registry });
    if (outcome.status === "completed") break;
    if (outcome.status !== "waiting")
      throw new Error("Live check run is already active.");
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, outcome.nextAttemptAt.getTime() - Date.now()),
      ),
    );
  }
  const savedRun = (await db.query.externalSiteRuns.findFirst())!;
  expect(savedRun).toMatchObject({ status: "succeeded", emittedItemCount: 2 });
  for (const lot of lots) {
    const saved = await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, lot.id),
    });
    expect(saved).toMatchObject({
      state: "closed",
      lastCheckedAt: lot.lastCheckedAt,
      volume: 700,
      sourceBottleIdentity: {
        cask_number: "3771",
        abv: 59,
        outturn: 633,
        vintage_year: 2009,
        bottling_year: 2023,
      },
    });
    expect(saved?.sourceDetailsCheckedAt).not.toBeNull();
  }
  expect(lots[0].id).not.toBe(lots[1].id);
}, 180_000);

test("checks scheduled discovery and the first real listing page within a three-request budget", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({
    type: "scotchwhiskyauctions",
    runEvery: 240,
    nextRunAt: null,
  });
  await syncScraperDefinitions(registry);
  const lifecycle = createScraperLifecycle({
    registry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueScheduledExternalSiteRun(site.id))!;
  await db
    .update(externalSiteRuns)
    .set({ requestLimit: 3 })
    .where(eq(externalSiteRuns.id, run.id));
  const outcome = await executeScraperRun({ runId: run.id }, { registry });
  expect(["completed", "waiting"]).toContain(outcome.status);
  const saved = (await db.query.externalSiteRuns.findFirst())!;
  expect(saved.cursor).toMatchObject({ scope: "current" });
  expect(saved.requestCount).toBeLessThanOrEqual(3);
  const lots = await db.query.auctionLots.findMany();
  expect(lots.length).toBeGreaterThan(0);
  expect(
    lots.every(
      (lot) =>
        lot.state === "live" ||
        lot.state === "closed" ||
        lot.state === "withdrawn",
    ),
  ).toBe(true);
  if (outcome.status === "waiting")
    expect(saved.cursor).toMatchObject({ page: 2, auctionIndex: 0 });
}, 180_000);
