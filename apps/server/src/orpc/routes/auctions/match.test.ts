import { createDecidedBottleClassification } from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import * as classifier from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db } from "@peated/server/db";
import {
  auctionLots,
  bottleChecks,
  bottleReferences,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { auctionLotCheckKey } from "@peated/server/lib/auctionMatchEvidence";
import { resolveAuctionLot } from "@peated/server/lib/auctionMatching";
import { upsertAuctionObservation } from "@peated/server/lib/auctions";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";
import { correctBottleReference } from "@peated/server/lib/bottleReferences";
import { pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import resolveAuctionLotJob from "@peated/server/worker/jobs/resolveAuctionLot";
import { eq } from "drizzle-orm";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
  type TestContext,
} from "vitest";

afterEach(() => vi.restoreAllMocks());

async function reviewedLot(
  fixtures: TestContext["fixtures"],
  referenceScope: "global_alias" | "none" | undefined = "global_alias",
) {
  const moderator = await fixtures.User({ mod: true });
  const bottle = await fixtures.Bottle();
  const site = await fixtures.ExternalSite();
  const observation = {
    auction: {
      sourceKey: "1",
      name: "Auction",
      url: "https://example.com/auction",
    },
    lot: {
      sourceKey: "1",
      name: "Example 12 Year Old",
      url: "https://example.com/lot",
      state: "closed" as const,
    },
    observedAt: new Date().toISOString(),
  };
  const { lot } = await upsertAuctionObservation(site.id, observation);
  const result = createDecidedBottleClassification({
    decision: {
      action: "match",
      matchedBottleId: bottle.id,
      candidateBottleIds: [bottle.id],
      rationale: "The label identifies this bottle.",
      identityScope: "product",
      referenceScope,
      observation: null,
      proposedBottle: null,
      confidenceBasis: { webEvidence: "not_used", unresolvedRisks: [] },
    },
    artifacts: { candidates: [(await getBottleCandidateById(bottle.id))!] },
  });
  const { check } = await createBottleCheck({
    intent: "resolve_reference",
    sourceKind: "auction_lot",
    sourceId: lot.id,
    backgroundEventKey: auctionLotCheckKey(lot.id, lot.sourceFingerprint),
    input: { reference: { id: lot.id, name: lot.name, url: lot.url } },
    result,
  });
  await db
    .update(auctionLots)
    .set({ matchCheckId: check.id, matchStatus: "review" })
    .where(eq(auctionLots.id, lot.id));
  const input = {
    lot: lot.id,
    bottleId: bottle.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
    expectedCheckId: check.id,
  };
  return {
    lot,
    bottle,
    site,
    check,
    moderator,
    observation,
    input,
    context: { user: moderator },
  };
}

describe("PUT /auction-lots/{lot}/bottle", () => {
  test("one remembered approval resolves a later occurrence and corrections preserve the reviewed lot", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    await routerClient.auctions.match(
      { ...data.input, rememberReference: true },
      { context: data.context },
    );
    const reference = await db.query.bottleReferences.findFirst({
      where: eq(
        bottleReferences.name,
        normalizeBottleReferenceKey(data.lot.name),
      ),
    });
    const actor = await getUserActor(data.moderator);
    expect(reference).toMatchObject({
      bottleId: data.bottle.id,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      matchedById: data.moderator.id,
      matchedReferenceId: null,
      matchCheckId: data.check.id,
    });
    const { lot: future } = await upsertAuctionObservation(data.site.id, {
      ...data.observation,
      auction: { ...data.observation.auction, sourceKey: "2" },
      lot: { ...data.observation.lot, sourceKey: "2" },
    });
    const run = vi.spyOn(classifier, "runScrapedBottleReference");
    await resolveAuctionLot(future.id, future.sourceFingerprint);
    expect(run).not.toHaveBeenCalled();
    expect(
      await db.query.auctionLots.findFirst({
        where: eq(auctionLots.id, future.id),
      }),
    ).toMatchObject({
      bottleId: data.bottle.id,
      matchedReferenceId: reference!.id,
    });
    expect(await db.query.auctionAlerts.findMany()).toHaveLength(0);
    const destination = await fixtures.Bottle();
    await correctBottleReference({
      referenceId: reference!.id,
      expectedBottleId: data.bottle.id,
      expectedIgnored: false,
      bottleId: destination.id,
      ignored: false,
      assignedByActorId: actor.id,
    });
    expect(
      await db.query.auctionLots.findFirst({
        where: eq(auctionLots.id, data.lot.id),
      }),
    ).toMatchObject({
      bottleId: data.bottle.id,
      matchedById: data.moderator.id,
    });
    expect(
      await db.query.auctionLots.findFirst({
        where: eq(auctionLots.id, future.id),
      }),
    ).toMatchObject({ bottleId: null, matchStatus: "pending" });
  });

  test("lot-only approval and overrides never remember a name", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    const other = await fixtures.Bottle();
    await expect(
      routerClient.auctions.match(
        { ...data.input, bottleId: other.id, rememberReference: true },
        { context: data.context },
      ),
    ).rejects.toThrow(/changed/i);
    await routerClient.auctions.match(
      { ...data.input, bottleId: other.id },
      { context: data.context },
    );
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(
          bottleReferences.name,
          normalizeBottleReferenceKey(data.lot.name),
        ),
      }),
    ).toBeUndefined();
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      bottleId: other.id,
    });
  });

  test.for(["none", "missing"] as const)(
    "%s reuse scope cannot remember a name",
    async (scope, { fixtures }) => {
      const data = await reviewedLot(
        fixtures,
        scope === "missing" ? "none" : scope,
      );
      if (scope === "missing")
        await db
          .update(bottleChecks)
          .set({
            output: {
              ...data.check.output,
              decision: { action: "match", matchedBottleId: data.bottle.id },
            },
          })
          .where(eq(bottleChecks.id, data.check.id));
      await expect(
        routerClient.auctions.match(
          { ...data.input, rememberReference: true },
          { context: data.context },
        ),
      ).rejects.toThrow(/changed/i);
      expect(await db.query.auctionLots.findFirst()).toMatchObject({
        bottleId: null,
        matchStatus: "review",
      });
    },
  );

  test.for(["ignored", "conflicting"] as const)(
    "%s references reject the whole save",
    async (kind, { fixtures }) => {
      const data = await reviewedLot(fixtures);
      const other = await fixtures.Bottle();
      const reference = await fixtures.BottleReference({
        name: normalizeBottleReferenceKey(data.lot.name),
        bottleId: kind === "ignored" ? null : other.id,
        ignored: kind === "ignored",
      });
      await expect(
        routerClient.auctions.match(
          { ...data.input, rememberReference: true },
          { context: data.context },
        ),
      ).rejects.toThrow(/ignored|assigned differently/i);
      expect(
        await db.query.bottleReferences.findFirst({
          where: eq(bottleReferences.id, reference.id),
        }),
      ).toMatchObject({
        bottleId: reference.bottleId,
        ignored: reference.ignored,
      });
      expect(await db.query.auctionLots.findFirst()).toMatchObject({
        bottleId: null,
      });
      expect(await db.query.incomingBottleDecisionLogs.findMany()).toHaveLength(
        0,
      );
      await routerClient.auctions.match(data.input, { context: data.context });
      expect(await db.query.auctionLots.findFirst()).toMatchObject({
        bottleId: data.bottle.id,
      });
    },
  );

  test("stale check or fingerprint rejects reference acceptance atomically", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    await expect(
      routerClient.auctions.match(
        { ...data.input, fingerprint: "stale", rememberReference: true },
        { context: data.context },
      ),
    ).rejects.toThrow(/changed/i);
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(
          bottleReferences.name,
          normalizeBottleReferenceKey(data.lot.name),
        ),
      }),
    ).toBeUndefined();
    await expect(
      routerClient.auctions.match(
        {
          ...data.input,
          expectedCheckId: data.check.id + 1,
          rememberReference: true,
        },
        { context: data.context },
      ),
    ).rejects.toThrow(/changed/i);
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      bottleId: null,
    });
  });

  test("requires moderator authority for review reads, assignment, and saved runs", async ({
    fixtures,
    defaults,
  }) => {
    const data = await reviewedLot(fixtures);
    await expect(
      routerClient.auctions.match(data.input, {
        context: { user: defaults.user },
      }),
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      routerClient.auctions.details(
        { lot: data.lot.id },
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      routerClient.audits.runs(
        { sourceKind: "auction_lot", sourceId: data.lot.id },
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow(/Unauthorized/);
    const details = await routerClient.auctions.details(
      { lot: data.lot.id },
      { context: data.context },
    );
    expect(details).toMatchObject({
      matchCheckId: data.check.id,
      suggestedBottle: { id: data.bottle.id },
      canRememberReference: true,
    });
    const { results } = await routerClient.audits.runs(
      { sourceKind: "auction_lot", sourceId: data.lot.id },
      { context: data.context },
    );
    expect(results).toHaveLength(1);
    expect(results[0].artifacts).toMatchObject({
      candidates: [expect.objectContaining({ bottleId: data.bottle.id })],
    });
  });

  test("ended lots enter one source-owned task and completed decisions enter History", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    const tasks = await routerClient.admin.moderation.listTasks(
      {},
      { context: data.context },
    );
    expect(tasks.results).toEqual([
      expect.objectContaining({
        key: `auction_lot:${data.lot.id}`,
        category: "listing",
        source: { kind: "auction_lot", lotId: data.lot.id },
      }),
    ]);
    expect(tasks.counts).toMatchObject({ all: 1, listing: 1 });
    expect(
      await routerClient.admin.moderation.task(
        { key: `auction_lot:${data.lot.id}` },
        { context: data.context },
      ),
    ).toMatchObject({ task: { title: data.lot.name } });
    await routerClient.auctions.match(data.input, { context: data.context });
    expect(
      (
        await routerClient.admin.moderation.listTasks(
          {},
          { context: data.context },
        )
      ).results,
    ).toEqual([]);
    const history = await routerClient.admin.moderation.listHistory(
      {},
      { context: data.context },
    );
    expect(history.results).toEqual([
      expect.objectContaining({
        title: data.lot.name,
        category: "listing",
        outcome: "match",
      }),
    ]);
  });
});

describe("POST /auction-lots/recheck", () => {
  test("a dispatch failure leaves durable work that can be safely queued again", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    const admin = await fixtures.User({ admin: true });
    const input = {
      lots: [
        {
          lotId: data.lot.id,
          fingerprint: data.lot.sourceFingerprint,
          expectedBottleId: null,
          expectedCheckId: data.check.id,
        },
      ],
    };
    pushUniqueJob.mockRejectedValueOnce(new Error("Queue unavailable"));
    await expect(
      routerClient.auctions.recheck(input, { context: { user: admin } }),
    ).rejects.toThrow(/Queue unavailable/);
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      matchStatus: "pending",
      matchCheckId: data.check.id,
    });
    expect(
      (
        await routerClient.admin.moderation.listTasks(
          {},
          { context: data.context },
        )
      ).results,
    ).toHaveLength(0);
    expect(
      await routerClient.auctions.recheck(input, { context: { user: admin } }),
    ).toEqual({ queued: [data.lot.id], skipped: [] });
    const run = vi.spyOn(classifier, "runScrapedBottleReference");
    await resolveAuctionLotJob({
      lotId: data.lot.id,
      fingerprint: data.lot.sourceFingerprint,
    });
    await resolveAuctionLotJob({
      lotId: data.lot.id,
      fingerprint: data.lot.sourceFingerprint,
    });
    expect(run).not.toHaveBeenCalled();
    expect(await db.query.bottleChecks.findMany()).toHaveLength(1);
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      matchStatus: "review",
    });
  });
  test("validates a whole batch, persists pending work and reuses saved evidence", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    const admin = await fixtures.User({ admin: true });
    const expected = {
      lotId: data.lot.id,
      fingerprint: data.lot.sourceFingerprint,
      expectedBottleId: null,
      expectedCheckId: data.check.id,
    };
    await expect(
      routerClient.auctions.recheck(
        { lots: [expected, { ...expected, lotId: data.lot.id + 100 }] },
        { context: { user: admin } },
      ),
    ).rejects.toThrow(/changed/i);
    expect(pushUniqueJob).not.toHaveBeenCalled();
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      matchStatus: "review",
    });
    expect(
      await routerClient.auctions.recheck(
        { lots: [expected] },
        { context: { user: admin } },
      ),
    ).toEqual({ queued: [data.lot.id], skipped: [] });
    expect(pushUniqueJob).toHaveBeenCalledWith("ResolveAuctionLot", {
      lotId: data.lot.id,
      fingerprint: data.lot.sourceFingerprint,
    });
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      matchStatus: "pending",
      matchCheckId: data.check.id,
    });
    const run = vi.spyOn(classifier, "runScrapedBottleReference");
    await resolveAuctionLot(data.lot.id, data.lot.sourceFingerprint);
    expect(run).not.toHaveBeenCalled();
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      matchStatus: "review",
      bottleId: null,
    });
  });

  test("restricts batches and authority and skips resolved decisions", async ({
    fixtures,
  }) => {
    const data = await reviewedLot(fixtures);
    const admin = await fixtures.User({ admin: true });
    const expected = {
      lotId: data.lot.id,
      fingerprint: data.lot.sourceFingerprint,
      expectedBottleId: null,
      expectedCheckId: data.check.id,
    };
    await expect(
      routerClient.auctions.recheck(
        { lots: [expected] },
        { context: data.context },
      ),
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      routerClient.auctions.recheck(
        {
          lots: Array.from({ length: 101 }, (_, index) => ({
            ...expected,
            lotId: index + 1,
          })),
        },
        { context: { user: admin } },
      ),
    ).rejects.toThrow(/validation/i);
    await expect(
      routerClient.auctions.recheck(
        { lots: [expected, expected] },
        { context: { user: admin } },
      ),
    ).rejects.toThrow(/validation/i);
    await routerClient.auctions.match(data.input, { context: data.context });
    expect(
      await routerClient.auctions.recheck(
        { lots: [{ ...expected, expectedBottleId: data.bottle.id }] },
        { context: { user: admin } },
      ),
    ).toEqual({ queued: [], skipped: [data.lot.id] });
    expect(pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveAuctionLot",
      expect.anything(),
    );
  });
});
