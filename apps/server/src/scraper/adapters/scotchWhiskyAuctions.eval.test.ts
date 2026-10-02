import { db } from "@peated/server/db";
import { auctionLots } from "@peated/server/db/schema";
import { upsertAuctionObservation } from "@peated/server/lib/auctions";
import { requestAuctionLotDetails } from "@peated/server/scraper";
import { eq } from "drizzle-orm";
import { createScraperLifecycle } from "../lifecycle";
import { scraperRegistry as registeredScrapers } from "../registry";
import { executeScraperRun } from "../runs";
import { syncScraperDefinitions } from "../syncDefinitions";

// Explicit live checks stay separate from deterministic tests and never touch production data.
test("collects published Ardbeg cask facts through the real paced source runtime", async ({
  fixtures,
}) => {
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
