import {
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
  type DecidedBottleClassificationResult,
} from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import * as classifier from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db } from "@peated/server/db";
import {
  auctionLots,
  bottleChecks,
  bottleReferences,
  bottleTombstones,
  bottles,
  type AuctionLot,
} from "@peated/server/db/schema";
import * as scraper from "@peated/server/scraper";
import { eq } from "drizzle-orm";
import { afterEach, vi } from "vitest";
import applyAuctionLotMatchJob from "../worker/jobs/applyAuctionLotMatch";
import { auctionLotCheckKey } from "./auctionMatchEvidence";
import {
  applySavedAuctionLotMatch,
  resolveAuctionLot,
} from "./auctionMatching";
import { assignAuctionLot, upsertAuctionObservation } from "./auctions";
import { createBottleCheck } from "./bottleChecks";
import { getBottleCandidateById } from "./bottleReferenceCandidates";
import { pushUniqueJob } from "./test/workerDispatch";

async function importedLot(
  siteId: number,
  facts?: Partial<NonNullable<AuctionLot["sourceBottleIdentity"]>>,
) {
  return (
    await upsertAuctionObservation(siteId, {
      auction: {
        sourceKey: "1",
        name: "Auction",
        url: "https://example.com/auction",
      },
      lot: {
        sourceKey: "1",
        name: "Example 12 Year Old",
        url: "https://example.com/lot",
        state: "closed",
        sourceBottleIdentity: facts,
      },
      observedAt: new Date().toISOString(),
    })
  ).lot;
}

async function matchResult(
  bottleId: number,
  overrides: Partial<
    Extract<DecidedBottleClassificationResult["decision"], { action: "match" }>
  > = {},
) {
  const candidate = await getBottleCandidateById(bottleId);
  if (!candidate) throw new Error("Test Bottle must be active.");
  return createDecidedBottleClassification({
    decision: {
      action: "match",
      matchedBottleId: bottleId,
      candidateBottleIds: [bottleId],
      identityScope: "product",
      referenceScope: "global_alias",
      rationale: "Source evidence identifies the bottle.",
      confidenceBasis: { webEvidence: "not_needed", unresolvedRisks: [] },
      observation: null,
      proposedBottle: null,
      ...overrides,
    },
    artifacts: { candidates: [candidate] },
  });
}

async function saveMatch(
  lot: AuctionLot,
  result: Awaited<ReturnType<typeof matchResult>>,
) {
  return (
    await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "auction_lot",
      sourceId: lot.id,
      backgroundEventKey: auctionLotCheckKey(lot.id, lot.sourceFingerprint),
      input: {
        reference: {
          id: lot.id,
          name: lot.name,
          url: lot.url,
          imageUrl: lot.imageUrl,
          currentBottleId: null,
        },
      },
      result,
    })
  ).check;
}

afterEach(() => vi.restoreAllMocks());

test("reuses an accepted reference without a new model decision", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const reference = await fixtures.BottleReference({
    name: normalizeBottleReferenceKey("Example 12 Year Old"),
    bottleId: bottle.id,
  });
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const { lot } = await upsertAuctionObservation(site.id, {
    auction: {
      sourceKey: "1",
      name: "Example auction",
      url: "https://example.com/auction",
    },
    lot: {
      sourceKey: "1",
      name: reference.name,
      url: "https://example.com/lot",
      state: "closed",
    },
    observedAt: new Date().toISOString(),
  });
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(run).not.toHaveBeenCalled();
  expect(pushUniqueJob).not.toHaveBeenCalledWith(
    "ResolveAuctionLot",
    expect.anything(),
  );
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: bottle.id,
    matchedReferenceId: reference.id,
    matchStatus: "matched",
    availableSince: null,
  });
});

test("unresolved classifier output remains reviewable and repeat-safe", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const { lot } = await upsertAuctionObservation(site.id, {
    auction: {
      sourceKey: "1",
      name: "Example auction",
      url: "https://example.com/auction",
    },
    lot: {
      sourceKey: "1",
      name: "Unknown whisky",
      url: "https://example.com/lot",
      imageUrl: "https://example.com/thumbnail.jpg",
      state: "closed",
    },
    observedAt: new Date().toISOString(),
  });
  const result = createDecidedBottleClassification({
    decision: {
      action: "no_match",
      rationale: "Not enough evidence.",
      candidateBottleIds: [],
      identityScope: "product",
      observation: null,
      matchedBottleId: null,
      proposedBottle: null,
    },
    artifacts: {},
  });
  const run = vi
    .spyOn(classifier, "runScrapedBottleReference")
    .mockResolvedValue({
      result,
      modelMetadata: {
        agentDurationMs: 0,
        usage: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        toolCalls: { count: 0, names: [] },
      },
    });
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(run).toHaveBeenCalledWith({
    readCandidateImages: false,
    reference: expect.objectContaining({
      id: lot.id,
      name: "Unknown whisky",
      imageUrl: null,
    }),
  });
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "review",
  });
  await db
    .update(auctionLots)
    .set({ matchStatus: "pending" })
    .where(eq(auctionLots.id, lot.id));
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(run).toHaveBeenCalledTimes(1);
  expect(await db.query.bottleChecks.findMany()).toHaveLength(1);
  expect(
    (await db.query.bottleChecks.findFirst())?.inputSnapshot,
  ).toMatchObject({
    readCandidateImages: false,
  });
});

test("ignored classifier output stays ignored after a retry", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const { lot } = await upsertAuctionObservation(site.id, {
    auction: {
      sourceKey: "1",
      name: "Example auction",
      url: "https://example.com/auction",
    },
    lot: {
      sourceKey: "1",
      name: "Gin",
      url: "https://example.com/lot",
      state: "closed",
    },
    observedAt: new Date().toISOString(),
  });
  const result = createIgnoredBottleClassification({
    reason: "non-whisky",
    artifacts: {},
  });
  const run = vi
    .spyOn(classifier, "runScrapedBottleReference")
    .mockResolvedValue({
      result,
      modelMetadata: {
        agentDurationMs: 0,
        usage: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        toolCalls: { count: 0, names: [] },
      },
    });
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  await db
    .update(auctionLots)
    .set({ matchStatus: "pending" })
    .where(eq(auctionLots.id, lot.id));
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(run).toHaveBeenCalledTimes(1);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "ignored",
  });
  expect(await db.query.bottleChecks.findMany()).toHaveLength(1);
});

test("a supported saved match applies without a model call or new reference", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const lot = await importedLot(site.id);
  const check = await saveMatch(lot, await matchResult(bottle.id));
  const referencesBefore = await db.query.bottleReferences.findMany();
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  // A model job already waiting for this version must leave the completed match alone.
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(run).not.toHaveBeenCalled();
  expect(pushUniqueJob).not.toHaveBeenCalledWith(
    "ResolveAuctionLot",
    expect.anything(),
  );
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: bottle.id,
    matchCheckId: check.id,
    matchedById: null,
    matchedReferenceId: null,
    matchStatus: "matched",
    availableSince: null,
  });
  expect(await db.query.bottleReferences.findMany()).toEqual(referencesBefore);
  const logs = await db.query.incomingBottleDecisionLogs.findMany();
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    sourceKind: "auction_lot",
    sourceId: lot.id,
    bottleId: bottle.id,
    metadata: { resolutionSource: "automatic" },
  });
  expect(await db.query.auctionAlerts.findMany()).toHaveLength(0);
});

test("a supported saved creation uses canonical creation and keeps its decision history", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const lot = await importedLot(site.id);
  const brand = await fixtures.Entity({ name: "Example", kind: "brand" });
  const before = await db.query.bottles.findMany();
  const result = createDecidedBottleClassification({
    decision: {
      action: "create_bottle",
      matchedBottleId: null,
      candidateBottleIds: [],
      identityScope: "product",
      referenceScope: "global_alias",
      rationale: "A catalog bottle is missing.",
      confidenceBasis: { webEvidence: "supportive", unresolvedRisks: [] },
      observation: null,
      proposedBottle: {
        name: "12 Year Old",
        brand: { id: brand.id, name: brand.name },
        distillers: [],
        bottler: null,
        series: null,
        category: "single_malt",
        statedAge: 12,
        abv: 46,
        edition: null,
        caskStrength: null,
        singleCask: null,
        vintageYear: null,
        releaseYear: null,
        maturation: null,
        caskNumber: null,
        outturn: null,
      },
    },
    artifacts: {},
  });
  const check = await saveMatch(lot, result);
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(run).not.toHaveBeenCalled();
  const saved = await db.query.auctionLots.findFirst();
  expect(saved).toMatchObject({
    bottleId: expect.any(Number),
    matchStatus: "matched",
    matchCheckId: check.id,
    matchedReferenceId: null,
  });
  expect(await db.query.bottles.findMany()).toHaveLength(before.length + 1);
  const bottle = await db.query.bottles.findFirst({
    where: eq(bottles.id, saved!.bottleId!),
  });
  expect(bottle).toMatchObject({
    name: "12-year-old",
    groupId: expect.any(Number),
    brandId: brand.id,
    statedAge: 12,
    abv: 46,
  });
  expect(
    await db.query.bottleReferences.findFirst({
      where: eq(bottleReferences.name, normalizeBottleReferenceKey(lot.name)),
    }),
  ).toBeUndefined();
  expect(await db.query.incomingBottleDecisionLogs.findMany()).toMatchObject([
    {
      decision: "create_bottle",
      bottleId: bottle!.id,
      createdBottle: true,
      metadata: { classifierEvidence: { checkId: check.id } },
    },
  ]);
  await applySavedAuctionLotMatch(lot.id, lot.sourceFingerprint);
  expect(await db.query.bottles.findMany()).toHaveLength(before.length + 1);
  expect(await db.query.incomingBottleDecisionLogs.findMany()).toHaveLength(1);
});

test.for(["unsupported", "reuse", "concurrent", "stale", "changed check"])(
  "creation is safe when %s",
  async (scenario, { fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "masterofmalt" });
    const brand = await fixtures.Entity({ name: "Example", kind: "brand" });
    const lot = await importedLot(site.id);
    const result = createDecidedBottleClassification({
      decision: {
        action: "create_bottle",
        matchedBottleId: null,
        candidateBottleIds: [],
        identityScope: "product",
        referenceScope: "none",
        rationale: "A missing marketed release.",
        observation: null,
        confidenceBasis: {
          webEvidence: scenario === "unsupported" ? "not_used" : "supportive",
          unresolvedRisks: [],
        },
        proposedBottle: {
          name: "12-year-old",
          brand: { id: brand.id, name: brand.name },
          distillers: [],
          bottler: null,
          series: null,
          category: "single_malt",
          statedAge: 12,
          abv: 46,
          edition: null,
          caskStrength: null,
          singleCask: null,
          vintageYear: null,
          releaseYear: null,
          maturation: null,
          caskNumber: null,
          outturn: null,
        },
      },
      artifacts: {},
    });
    const existing =
      scenario === "reuse"
        ? await fixtures.Bottle({
            name: "12-year-old",
            brandId: brand.id,
            category: "single_malt",
            statedAge: 12,
            abv: 46,
          })
        : null;
    const check = await saveMatch(lot, result);
    if (scenario === "stale" || scenario === "changed check") {
      if (scenario === "stale")
        await db
          .update(auctionLots)
          .set({ sourceFingerprint: "changed" })
          .where(eq(auctionLots.id, lot.id));
      else
        await db
          .update(auctionLots)
          .set({ matchCheckId: check.id })
          .where(eq(auctionLots.id, lot.id));
      await expect(
        assignAuctionLot({
          lotId: lot.id,
          fingerprint: lot.sourceFingerprint,
          expectedBottleId: null,
          createBottle: true,
          checkId: check.id,
          automatic: true,
          expectedCheckId:
            scenario === "changed check" ? check.id + 1 : undefined,
        }),
      ).rejects.toThrow("Auction lot identity or assignment changed");
    } else {
      await Promise.all(
        Array.from({ length: scenario === "concurrent" ? 2 : 1 }, () =>
          applySavedAuctionLotMatch(lot.id, lot.sourceFingerprint),
        ),
      );
    }
    const saved = await db.query.auctionLots.findFirst();
    const shouldApply = scenario === "reuse" || scenario === "concurrent";
    expect(saved).toMatchObject({
      bottleId: shouldApply ? (existing?.id ?? expect.any(Number)) : null,
      matchStatus: shouldApply
        ? "matched"
        : scenario === "unsupported"
          ? "review"
          : "pending",
    });
    expect(await db.query.bottles.findMany()).toHaveLength(shouldApply ? 1 : 0);
    expect(await db.query.bottleGroups.findMany()).toHaveLength(
      shouldApply ? 1 : 0,
    );
    const logs = await db.query.incomingBottleDecisionLogs.findMany();
    expect(logs).toHaveLength(shouldApply ? 1 : 0);
    if (shouldApply)
      expect(logs[0]).toMatchObject({
        decision: existing ? "match" : "create_bottle",
        createdBottle: !existing,
      });
  },
);

test("unsupported saved check schemas stay in review rather than calling the model again", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const lot = await importedLot(site.id);
  const check = await saveMatch(lot, await matchResult(bottle.id));
  await db
    .update(bottleChecks)
    .set({ schemaVersion: 999 })
    .where(eq(bottleChecks.id, check.id));
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(run).not.toHaveBeenCalled();
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchCheckId: check.id,
    matchStatus: "review",
  });
});

test.for([
  { name: "missing confidence metadata", confidenceBasis: null },
  {
    name: "missing supporting evidence",
    confidenceBasis: { webEvidence: "not_used" as const, unresolvedRisks: [] },
  },
  {
    name: "release ambiguity",
    confidenceBasis: {
      webEvidence: "supportive" as const,
      unresolvedRisks: [
        {
          category: "release_ambiguity" as const,
          note: "Release year is unclear.",
        },
      ],
    },
  },
])("$name stays reviewable", async ({ confidenceBasis }, { fixtures }) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const lot = await importedLot(site.id);
  await saveMatch(lot, await matchResult(bottle.id, { confidenceBasis }));
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(run).not.toHaveBeenCalled();
  expect(pushUniqueJob).not.toHaveBeenCalledWith(
    "ResolveAuctionLot",
    expect.anything(),
  );
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "review",
  });
});

test("populated source conflicts and changed target facts block a saved match", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle({ statedAge: 12, abv: 46 });
  const lot = await importedLot(site.id, { stated_age: 12, abv: 46 });
  await saveMatch(lot, await matchResult(bottle.id));
  await db
    .update(bottles)
    .set({ statedAge: 18 })
    .where(eq(bottles.id, bottle.id));
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "review",
  });
});

test.for(["masterofmalt", "scotchwhiskyauctions"] as const)(
  "a recheck without saved evidence queues source work for %s without running the model",
  async (type, { fixtures }) => {
    const site = await fixtures.ExternalSite({ type });
    const lot = await importedLot(site.id);
    const args = { lotId: lot.id, fingerprint: lot.sourceFingerprint };
    const run = vi.spyOn(classifier, "runScrapedBottleReference");
    await applyAuctionLotMatchJob(args);
    expect(run).not.toHaveBeenCalled();
    if (type === "scotchwhiskyauctions") {
      expect(pushUniqueJob).not.toHaveBeenCalled();
      expect(
        (await db.query.auctionLots.findFirst())?.sourceDetailsRequestedAt,
      ).toBeInstanceOf(Date);
    } else {
      expect(pushUniqueJob).toHaveBeenCalledWith("ResolveAuctionLot", args);
      expect(
        (await db.query.auctionLots.findFirst())?.sourceDetailsRequestedAt,
      ).toBeNull();
    }
    expect(await db.query.bottleChecks.findMany()).toHaveLength(0);
    expect(await db.query.auctionLots.findFirst()).toMatchObject({
      bottleId: null,
      matchStatus: "pending",
    });
  },
);

test("a conflicting accepted name cannot bypass source facts on the fast queue", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle({ statedAge: 18 });
  const lot = await importedLot(site.id, { stated_age: 12 });
  await fixtures.BottleReference({
    name: normalizeBottleReferenceKey(lot.name),
    bottleId: bottle.id,
  });
  const args = { lotId: lot.id, fingerprint: lot.sourceFingerprint };
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob(args);
  expect(run).not.toHaveBeenCalled();
  expect(pushUniqueJob).toHaveBeenCalledWith("ResolveAuctionLot", args);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "pending",
    matchedReferenceId: null,
  });
  expect(await db.query.incomingBottleDecisionLogs.findMany()).toHaveLength(0);
});

test("failed model dispatch stays pending and can be retried without classifying inline", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const lot = await importedLot(site.id);
  const args = { lotId: lot.id, fingerprint: lot.sourceFingerprint };
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  pushUniqueJob.mockRejectedValueOnce(new Error("Queue unavailable"));
  await expect(applyAuctionLotMatchJob(args)).rejects.toThrow(
    "Queue unavailable",
  );
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "pending",
  });
  await applyAuctionLotMatchJob(args);
  expect(pushUniqueJob).toHaveBeenCalledWith("ResolveAuctionLot", args);
  expect(run).not.toHaveBeenCalled();
  expect(await db.query.bottleChecks.findMany()).toHaveLength(0);
});

test("stale or already reviewed rechecks do not dispatch model work", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const lot = await importedLot(site.id);
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await applyAuctionLotMatchJob({ lotId: lot.id, fingerprint: "stale" });
  await db
    .update(auctionLots)
    .set({ matchStatus: "review" })
    .where(eq(auctionLots.id, lot.id));
  await applyAuctionLotMatchJob({
    lotId: lot.id,
    fingerprint: lot.sourceFingerprint,
  });
  expect(run).not.toHaveBeenCalled();
  expect(pushUniqueJob).not.toHaveBeenCalledWith(
    "ResolveAuctionLot",
    expect.anything(),
  );
});

test("saved-match jobs reject unowned payload fields before making changes", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const lot = await importedLot(site.id);
  const run = vi.spyOn(classifier, "runScrapedBottleReference");
  await expect(
    applyAuctionLotMatchJob({
      lotId: lot.id,
      fingerprint: lot.sourceFingerprint,
      bottleId: 123,
    }),
  ).rejects.toThrow();
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    matchStatus: "pending",
    bottleId: null,
  });
  expect(run).not.toHaveBeenCalled();
  expect(pushUniqueJob).not.toHaveBeenCalled();
});

test.for(["changed", "review", "matched"] as const)(
  "a lot changed to %s while requesting details does not start stale classification",
  async (change, { fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
    const lot = await importedLot(site.id);
    const bottle = await fixtures.Bottle();
    const mod = await fixtures.User({ mod: true });
    const run = vi
      .spyOn(classifier, "runScrapedBottleReference")
      .mockResolvedValue({
        result: await matchResult(bottle.id),
        modelMetadata: null,
      });
    vi.spyOn(scraper, "requestAuctionLotDetails").mockImplementation(
      async () => {
        if (change === "matched") {
          await assignAuctionLot({
            lotId: lot.id,
            bottleId: bottle.id,
            fingerprint: lot.sourceFingerprint,
            expectedBottleId: null,
            userId: mod.id,
          });
        } else {
          await db
            .update(auctionLots)
            .set(
              change === "changed"
                ? { sourceFingerprint: "changed" }
                : { matchStatus: "review" },
            )
            .where(eq(auctionLots.id, lot.id));
        }
        return false;
      },
    );
    await resolveAuctionLot(lot.id, lot.sourceFingerprint);
    expect(run).not.toHaveBeenCalled();
    expect(await db.query.bottleChecks.findMany()).toHaveLength(0);
    expect(await db.query.auctionLots.findFirst()).toMatchObject(
      change === "changed"
        ? { sourceFingerprint: "changed", matchCheckId: null }
        : change === "matched"
          ? { bottleId: bottle.id, matchedById: mod.id, matchStatus: "matched" }
          : { matchStatus: "review", matchCheckId: null },
    );
  },
);

test("a source identity change during classification cannot apply the old decision", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const lot = await importedLot(site.id);
  const result = await matchResult(bottle.id);
  vi.spyOn(classifier, "runScrapedBottleReference").mockImplementation(
    async () => {
      await db
        .update(auctionLots)
        .set({ sourceFingerprint: "changed" })
        .where(eq(auctionLots.id, lot.id));
      return { result, modelMetadata: null };
    },
  );
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchCheckId: null,
    sourceFingerprint: "changed",
  });
});

test("an exact-reference classifier preflight keeps its dependency", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const lot = await importedLot(site.id);
  const result = await matchResult(bottle.id);
  const referenceName = normalizeBottleReferenceKey(lot.name);
  result.artifacts.candidates[0].reference = referenceName;
  result.artifacts.candidates[0].source.push("exact");
  vi.spyOn(classifier, "runScrapedBottleReference").mockImplementation(
    async () => {
      await fixtures.BottleReference({
        name: referenceName,
        bottleId: bottle.id,
      });
      return { result, modelMetadata: null };
    },
  );
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  const reference = await db.query.bottleReferences.findFirst({
    where: eq(bottleReferences.name, referenceName),
  });
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: bottle.id,
    matchedReferenceId: reference!.id,
  });
});

test("a new supported match applies and a concurrent reviewed assignment wins", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const other = await fixtures.Bottle();
  const mod = await fixtures.User({ mod: true });
  const lot = await importedLot(site.id);
  const result = await matchResult(bottle.id);
  const run = vi
    .spyOn(classifier, "runScrapedBottleReference")
    .mockResolvedValue({ result, modelMetadata: null });
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: bottle.id,
    matchedById: null,
  });
  const second = (
    await upsertAuctionObservation(site.id, {
      auction: {
        sourceKey: "1",
        name: "Auction",
        url: "https://example.com/auction",
      },
      lot: {
        sourceKey: "2",
        name: "Another whisky",
        url: "https://example.com/lot-2",
        state: "closed",
      },
      observedAt: new Date().toISOString(),
    })
  ).lot;
  run.mockImplementation(async () => {
    await assignAuctionLot({
      lotId: second.id,
      bottleId: other.id,
      fingerprint: second.sourceFingerprint,
      expectedBottleId: null,
      userId: mod.id,
    });
    return { result, modelMetadata: null };
  });
  await resolveAuctionLot(second.id, second.sourceFingerprint);
  expect(
    await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, second.id),
    }),
  ).toMatchObject({ bottleId: other.id, matchedById: mod.id });
});

test("unknown and inactive targets cannot auto-assign", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "masterofmalt" });
  const bottle = await fixtures.Bottle();
  const lot = await importedLot(site.id);
  const result = await matchResult(bottle.id);
  result.artifacts.candidates = [];
  await saveMatch(lot, result);
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "review",
  });
  await db
    .update(bottleChecks)
    .set({ artifacts: (await matchResult(bottle.id)).artifacts })
    .where(
      eq(
        bottleChecks.backgroundEventKey,
        auctionLotCheckKey(lot.id, lot.sourceFingerprint),
      ),
    );
  await db
    .insert(bottleTombstones)
    .values({ bottleId: bottle.id, newBottleId: null });
  await db
    .update(auctionLots)
    .set({ matchStatus: "pending" })
    .where(eq(auctionLots.id, lot.id));
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: null,
    matchStatus: "review",
  });
});
