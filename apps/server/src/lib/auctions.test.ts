import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { db } from "@peated/server/db";
import {
  auctionAlerts,
  auctionLotResults,
  auctionLots,
  auctionWatches,
  notifications,
} from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import type { AuctionObservation } from "@peated/server/schemas/auctions";
import { eq } from "drizzle-orm";
import { getUserActor } from "./actors";
import {
  assignAuctionLot,
  auctionAvailability,
  AuctionLotMatchChangedError,
  hasAuctionIdentityConflict,
  notifyAuctionLot,
  upsertAuctionObservation,
} from "./auctions";
import { correctBottleReference } from "./bottleReferences";
import { mergeBottles } from "./mergeBottles";

function observation(
  overrides: Partial<AuctionObservation["lot"]> = {},
  time = Date.now() - 2000,
): AuctionObservation {
  return {
    auction: {
      sourceKey: "auction-1",
      name: "September auction",
      url: "https://example.com/auction-1",
    },
    lot: {
      sourceKey: "lot-1",
      name: "Example 12 Year Old",
      url: "https://example.com/auction-1/lot-1",
      state: "live",
      ...overrides,
    },
    observedAt: new Date(time).toISOString(),
  };
}

test("repeating or older observations cannot duplicate or regress a lot", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const input = observation({ currentBid: 10000, bidCurrency: "gbp" });
  const first = await upsertAuctionObservation(site.id, input);
  const duplicate = await upsertAuctionObservation(site.id, input);
  expect(duplicate.lot.id).toBe(first.lot.id);
  expect(duplicate.isNew).toBe(false);
  await upsertAuctionObservation(
    site.id,
    observation({ currentBid: 9000, bidCurrency: "gbp" }, Date.now() - 5000),
  );
  expect(await db.query.auctionLots.findMany()).toHaveLength(1);
  expect((await db.query.auctionLots.findFirst())?.currentBid).toBe(10000);
  expect(await db.query.auctionLotResults.findMany()).toHaveLength(0);
});

test("a relisting in another auction is a separate occurrence", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const first = await upsertAuctionObservation(site.id, observation());
  const input = observation();
  input.auction.sourceKey = "auction-2";
  const second = await upsertAuctionObservation(site.id, input);
  expect(second.lot.id).not.toBe(first.lot.id);
  expect(await db.query.auctionLots.findMany()).toHaveLength(2);
});

test("confirmed results are revised without overwriting history", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const sold = {
    outcome: "sold",
    amount: 10000,
    currency: "gbp",
    priceKind: "hammer",
    soldAt: null,
  } as const;
  const first = await upsertAuctionObservation(
    site.id,
    observation({ state: "closed", result: sold }, Date.now() - 5000),
  );
  await upsertAuctionObservation(
    site.id,
    observation({ state: "closed", result: sold }, Date.now() - 4000),
  );
  await upsertAuctionObservation(
    site.id,
    observation(
      { state: "closed", result: { ...sold, amount: 11000 } },
      Date.now() - 3000,
    ),
  );
  await upsertAuctionObservation(site.id, observation({ state: "closed" }));
  const results = await db
    .select()
    .from(auctionLotResults)
    .orderBy(auctionLotResults.id);
  expect(results.map((result) => result.amount)).toEqual([10000, 11000]);
  const bottle = await fixtures.Bottle();
  await assignAuctionLot({
    lotId: first.lot.id,
    bottleId: bottle.id,
    fingerprint: first.lot.sourceFingerprint,
    expectedBottleId: null,
  });
  const page = await routerClient.auctions.list({ bottle: bottle.id });
  expect(page.results[0]).toMatchObject({
    availability: "unavailable",
    result: { outcome: "sold", amount: 11000, priceKind: "hammer" },
  });
});

test("identity changes invalidate assignments and stale moderator decisions", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const bottle = await fixtures.Bottle();
  const first = await upsertAuctionObservation(
    site.id,
    observation({ volume: 700, sourceBottleIdentity: { stated_age: 12 } }),
  );
  await assignAuctionLot({
    lotId: first.lot.id,
    bottleId: bottle.id,
    fingerprint: first.lot.sourceFingerprint,
    expectedBottleId: null,
  });
  const next = await upsertAuctionObservation(
    site.id,
    observation({ name: "Example 18 Year Old" }, Date.now() - 1000),
  );
  expect(next.lot).toMatchObject({
    bottleId: null,
    matchStatus: "pending",
    volume: null,
    sourceBottleIdentity: null,
  });
  await expect(
    assignAuctionLot({
      lotId: first.lot.id,
      bottleId: bottle.id,
      fingerprint: first.lot.sourceFingerprint,
      expectedBottleId: null,
    }),
  ).rejects.toBeInstanceOf(AuctionLotMatchChangedError);
  expect(
    (await routerClient.auctions.list({ bottle: bottle.id })).results,
  ).toHaveLength(0);
});

test("freshness and deadlines do not invent a sale or close an aftersale", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const lot = { state: "live" as const, lastCheckedAt: now, endsAt: null };
  expect(auctionAvailability(lot, now)).toBe("live");
  expect(auctionAvailability({ ...lot, endsAt: now }, now)).toBe("unknown");
  expect(
    auctionAvailability(
      { ...lot, lastCheckedAt: new Date("2026-09-30T06:00:00Z") },
      now,
    ),
  ).toBe("unknown");
  expect(
    auctionAvailability(
      { ...lot, state: "closed", lastCheckedAt: new Date(0) },
      now,
    ),
  ).toBe("unavailable");
  expect(
    auctionAvailability(
      { ...lot, state: "aftersale", endsAt: new Date(0) },
      now,
    ),
  ).toBe("aftersale");
});

test("conflicting cask and bottling fields cannot reuse a reference", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle({
    caskNumber: "123",
    bottlingYear: 2020,
  });
  expect(
    hasAuctionIdentityConflict(
      BottleExtractedDetailsSchema.parse({ cask_number: "124" }),
      bottle,
    ),
  ).toBe(true);
  expect(
    hasAuctionIdentityConflict(
      BottleExtractedDetailsSchema.parse({ bottling_year: 2021 }),
      bottle,
    ),
  ).toBe(true);
  expect(
    hasAuctionIdentityConflict(
      BottleExtractedDetailsSchema.parse({
        cask_number: "123",
        bottling_year: 2020,
      }),
      bottle,
    ),
  ).toBe(false);
});

test("an auction deadline bounds a lot unless the source explicitly extends the lot", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const input = observation();
  input.auction.endsAt = new Date(Date.now() - 1000).toISOString();
  const first = await upsertAuctionObservation(site.id, input);
  expect(auctionAvailability(first.lot)).toBe("unknown");
  const extended = observation(
    { endsAt: new Date(Date.now() + 60_000).toISOString() },
    Date.now() - 500,
  );
  const updated = await upsertAuctionObservation(site.id, extended);
  expect(auctionAvailability(updated.lot)).toBe("live");
});

test("watch alerts are transactional, owned, and deduplicated after dismissal", async ({
  fixtures,
  defaults,
}) => {
  const site = await fixtures.ExternalSite();
  const bottle = await fixtures.Bottle();
  const context = { context: { user: defaults.user } };
  await routerClient.auctions.updateWatch(
    { bottle: bottle.id, watching: true },
    context,
  );
  const { lot } = await upsertAuctionObservation(site.id, observation());
  await assignAuctionLot({
    lotId: lot.id,
    bottleId: bottle.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
  });
  expect(await notifyAuctionLot(lot.id)).toBe(1);
  expect(await notifyAuctionLot(lot.id)).toBe(0);
  const page = await routerClient.notifications.list({}, context);
  expect(page.results[0]).toMatchObject({
    type: "auction_available",
    ref: { lotId: lot.id, bottle: { id: bottle.id } },
  });
  const otherUser = await fixtures.User();
  expect(
    (
      await routerClient.notifications.list(
        {},
        { context: { user: otherUser } },
      )
    ).results,
  ).toHaveLength(0);
  await db
    .delete(notifications)
    .where(eq(notifications.id, page.results[0].id));
  expect(await notifyAuctionLot(lot.id)).toBe(0);
  expect(await db.query.auctionAlerts.findMany()).toHaveLength(1);
});

test("watching an existing live lot does not send an old alert", async ({
  fixtures,
  defaults,
}) => {
  const site = await fixtures.ExternalSite();
  const bottle = await fixtures.Bottle();
  const { lot } = await upsertAuctionObservation(site.id, observation());
  await assignAuctionLot({
    lotId: lot.id,
    bottleId: bottle.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
  });
  await db.insert(auctionWatches).values({
    userId: defaults.user.id,
    bottleId: bottle.id,
    createdAt: new Date(Date.now() + 1000),
  });
  expect(await notifyAuctionLot(lot.id)).toBe(0);
});

test("unwatching prevents a queued alert and cannot change another user's watch", async ({
  fixtures,
  defaults,
}) => {
  const site = await fixtures.ExternalSite();
  const bottle = await fixtures.Bottle();
  const otherUser = await fixtures.User();
  const context = { context: { user: defaults.user } };
  await routerClient.auctions.updateWatch(
    { bottle: bottle.id, watching: true },
    context,
  );
  await routerClient.auctions.updateWatch(
    { bottle: bottle.id, watching: true },
    { context: { user: otherUser } },
  );
  const { lot } = await upsertAuctionObservation(site.id, observation());
  await assignAuctionLot({
    lotId: lot.id,
    bottleId: bottle.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
  });
  await routerClient.auctions.updateWatch(
    { bottle: bottle.id, watching: false },
    context,
  );
  expect(await notifyAuctionLot(lot.id)).toBe(1);
  expect(
    (await db.query.auctionAlerts.findMany()).map((alert) => alert.userId),
  ).toEqual([otherUser.id]);
});

test("auction moderation and watch mutations require the right access", async ({
  fixtures,
  defaults,
}) => {
  const bottle = await fixtures.Bottle();
  await expect(
    routerClient.auctions.updateWatch({ bottle: bottle.id, watching: true }),
  ).rejects.toThrow();
  await expect(routerClient.auctions.matchQueue({})).rejects.toThrow();
  await expect(
    routerClient.auctions.matchQueue({}, { context: { user: defaults.user } }),
  ).rejects.toThrow();
});

test("database constraints reject incomplete bid and result money", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const { lot } = await upsertAuctionObservation(site.id, observation());
  await expect(
    db
      .update(auctionLots)
      .set({ currentBid: 10000, bidCurrency: null })
      .where(eq(auctionLots.id, lot.id)),
  ).rejects.toThrow();
  await expect(
    db.insert(auctionLotResults).values({
      lotId: lot.id,
      outcome: "sold",
      amount: 10000,
      currency: null,
      priceKind: "hammer",
      sourceUrl: lot.url,
      observedAt: new Date(),
    }),
  ).rejects.toThrow();
});

test("reference corrections invalidate automatic matches but leave manual decisions intact", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const source = await fixtures.Bottle();
  const destination = await fixtures.Bottle();
  const mod = await fixtures.User({ mod: true });
  const actor = await getUserActor(mod);
  const reference = await fixtures.BottleReference({
    name: "Accepted auction name",
    bottleId: source.id,
  });
  const automatic = await upsertAuctionObservation(
    site.id,
    observation({ name: reference.name }),
  );
  const manual = await upsertAuctionObservation(
    site.id,
    observation({ sourceKey: "lot-2", name: reference.name }),
  );
  await assignAuctionLot({
    lotId: automatic.lot.id,
    bottleId: source.id,
    fingerprint: automatic.lot.sourceFingerprint,
    expectedBottleId: null,
    referenceName: reference.name,
  });
  await assignAuctionLot({
    lotId: manual.lot.id,
    bottleId: source.id,
    fingerprint: manual.lot.sourceFingerprint,
    expectedBottleId: null,
    userId: mod.id,
  });
  await correctBottleReference({
    referenceId: reference.id,
    expectedBottleId: source.id,
    expectedIgnored: false,
    bottleId: destination.id,
    ignored: false,
    assignedByActorId: actor.id,
  });
  expect(
    await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, automatic.lot.id),
    }),
  ).toMatchObject({ bottleId: null, matchStatus: "pending" });
  expect(
    await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, manual.lot.id),
    }),
  ).toMatchObject({ bottleId: source.id, matchStatus: "matched" });
  await expect(
    assignAuctionLot({
      lotId: automatic.lot.id,
      bottleId: source.id,
      fingerprint: automatic.lot.sourceFingerprint,
      expectedBottleId: null,
      referenceName: reference.name,
    }),
  ).rejects.toBeInstanceOf(AuctionLotMatchChangedError);
  await correctBottleReference({
    referenceId: reference.id,
    expectedBottleId: destination.id,
    expectedIgnored: false,
    bottleId: null,
    ignored: true,
    assignedByActorId: actor.id,
  });
  expect(
    await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, automatic.lot.id),
    }),
  ).toMatchObject({
    bottleId: null,
    matchStatus: "ignored",
    matchedReferenceId: reference.id,
  });
  await correctBottleReference({
    referenceId: reference.id,
    expectedBottleId: null,
    expectedIgnored: true,
    bottleId: destination.id,
    ignored: false,
    assignedByActorId: actor.id,
  });
  expect(
    await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, automatic.lot.id),
    }),
  ).toMatchObject({ bottleId: null, matchStatus: "pending" });
});

test("a Bottle with auction history cannot be deleted", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
  const bottle = await fixtures.Bottle();
  const admin = await fixtures.User({ admin: true });
  const { lot } = await upsertAuctionObservation(
    site.id,
    observation({ state: "closed" }),
  );
  await assignAuctionLot({
    lotId: lot.id,
    bottleId: bottle.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
  });
  await expect(
    routerClient.bottles.delete(
      { bottle: bottle.id },
      { context: { user: admin } },
    ),
  ).rejects.toThrow(/auction/i);
});

test("Bottle merges preserve lots, results, alerts, and collapse duplicate watches", async ({
  fixtures,
  defaults,
}) => {
  const site = await fixtures.ExternalSite();
  const source = await fixtures.Bottle();
  const destination = await fixtures.Bottle();
  const mod = await fixtures.User({ mod: true });
  await db.insert(auctionWatches).values([
    { userId: defaults.user.id, bottleId: source.id },
    { userId: defaults.user.id, bottleId: destination.id },
  ]);
  const { lot } = await upsertAuctionObservation(site.id, observation());
  await assignAuctionLot({
    lotId: lot.id,
    bottleId: source.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
  });
  await notifyAuctionLot(lot.id);
  await upsertAuctionObservation(
    site.id,
    observation(
      {
        state: "closed",
        result: {
          outcome: "sold",
          amount: 10000,
          currency: "gbp",
          priceKind: "hammer",
          soldAt: null,
        },
      },
      Date.now() - 1000,
    ),
  );
  await mergeBottles({
    sourceBottleId: source.id,
    destinationBottleId: destination.id,
    context: { user: mod },
  });
  expect((await db.query.auctionLots.findFirst())?.bottleId).toBe(
    destination.id,
  );
  expect((await db.query.auctionAlerts.findFirst())?.bottleId).toBe(
    destination.id,
  );
  expect(await db.query.auctionLotResults.findMany()).toHaveLength(1);
  expect(await db.query.auctionWatches.findMany()).toMatchObject([
    { bottleId: destination.id },
  ]);
});
