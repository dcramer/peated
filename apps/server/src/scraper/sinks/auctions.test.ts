import { db } from "@peated/server/db";
import { auctionAlerts, auctionLots } from "@peated/server/db/schema";
import * as worker from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import resolveAuctionLotJob from "@peated/server/worker/jobs/resolveAuctionLot";
import { auctionSink } from "./auctions";

test("collection queues matching, then the worker publishes one live alert", async ({
  fixtures,
  defaults,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const bottle = await fixtures.Bottle();
  const reference = await fixtures.BottleReference({
    name: "Accepted whisky",
    bottleId: bottle.id,
  });
  await routerClient.auctions.updateWatch(
    { bottle: bottle.id, watching: true },
    { context: { user: defaults.user } },
  );
  const observation = {
    sourceKey: "232:page:1",
    value: [
      {
        auction: {
          sourceKey: "232",
          name: "September auction",
          url: "https://example.com/auction",
        },
        lot: {
          sourceKey: "897061",
          name: reference.name,
          url: "https://example.com/lot",
          state: "live" as const,
        },
        observedAt: new Date().toISOString(),
      },
    ],
  };
  expect(await auctionSink({ externalSiteId: site.id, observation })).toEqual({
    newItemCount: 1,
    existingItemCount: 0,
  });
  const lot = await db.query.auctionLots.findFirst();
  if (!lot) throw new Error("Collector did not save the lot.");
  expect(worker.pushUniqueJob).toHaveBeenCalledWith("ResolveAuctionLot", {
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  await resolveAuctionLotJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(
    (await routerClient.auctions.list({ bottle: bottle.id })).results[0],
  ).toMatchObject({ availability: "live", bottleId: bottle.id });
  expect(await auctionSink({ externalSiteId: site.id, observation })).toEqual({
    newItemCount: 0,
    existingItemCount: 1,
  });
  await resolveAuctionLotJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(await db.query.auctionAlerts.findMany()).toHaveLength(1);
});
