import { createDecidedBottleClassification } from "@peated/bottle-classifier/contract";
import * as classifier from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db } from "@peated/server/db";
import {
  auctionLots,
  externalSiteRuns,
  externalSites,
  type AuctionLot,
} from "@peated/server/db/schema";
import { auctionLotCheckKey } from "@peated/server/lib/auctionMatchEvidence";
import { resolveAuctionLot } from "@peated/server/lib/auctionMatching";
import {
  assignAuctionLot,
  saveAuctionLotDetails,
  upsertAuctionObservation,
} from "@peated/server/lib/auctions";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";
import { pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { requestAuctionLotDetails } from "@peated/server/scraper";
import { eq } from "drizzle-orm";
import { afterEach, vi } from "vitest";
import { parseScotchWhiskyAuctionDetails } from "./adapters/scotchWhiskyAuctionDetails";
import { ScotchWhiskyAuctionDetailsCursorSchema } from "./adapters/scotchWhiskyAuctions";
import { createScraperLifecycle } from "./lifecycle";
import { scraperRegistry as registeredScrapers } from "./registry";
import { executeScraperRun } from "./runs";
import { auctionSink } from "./sinks/auctions";
import { syncScraperDefinitions } from "./syncDefinitions";

const scraperRegistry = {
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

const name = "Ardbeg 2009 14 Year Old Single Cask #3771 Feis Ile 2024";
const url =
  "https://www.scotchwhiskyauctions.com/auctions/232-the-183rd-auction/893368-ardbeg-2009-14-year-old-single-cask-3771-feis-ile-2024/";
const detailHtml = `<main><h1>${name}</h1><div class="lotinfo"><div class="descr"><p>Cask Number: 3771</p><p>59% ABV / 70cl</p><p>Bottle Number: 573 / 633</p><p>Bottled: 18.10.2023</p></div></div></main>`;
const modelMetadata = {
  agentDurationMs: 0,
  usage: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  toolCalls: { count: 0, names: [] },
};

async function importedLot(siteId: number, sourceKey = "893368") {
  return (
    await upsertAuctionObservation(siteId, {
      auction: {
        sourceKey: "232",
        name: "The 183rd auction",
        url: "https://www.scotchwhiskyauctions.com/auctions/232-the-183rd-auction/",
      },
      lot: {
        sourceKey,
        name,
        url: url.replace("893368", sourceKey),
        state: "closed",
        result: {
          outcome: "sold",
          amount: 34000,
          currency: "gbp",
          priceKind: "hammer",
          soldAt: null,
        },
      },
      observedAt: new Date(Date.now() - 2_000).toISOString(),
    })
  ).lot;
}

async function requestReview(lot: AuctionLot) {
  await db
    .update(auctionLots)
    .set({ matchStatus: "review" })
    .where(eq(auctionLots.id, lot.id));
  await requestAuctionLotDetails(lot.id, lot.sourceFingerprint);
}

afterEach(() => vi.restoreAllMocks());

test("new unmapped lot reads bounded details before its first model check and keeps price history", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({
    type: "scotchwhiskyauctions",
    runEvery: null,
  });
  const lot = await importedLot(site.id);
  const bottle = await fixtures.Bottle({
    caskNumber: "3771",
    abv: 59,
    outturn: 633,
    bottlingYear: 2023,
  });
  const candidate = await getBottleCandidateById(bottle.id);
  const model = vi
    .spyOn(classifier, "runScrapedBottleReference")
    .mockResolvedValueOnce({
      result: createDecidedBottleClassification({
        decision: {
          action: "match",
          rationale: "Cask facts agree.",
          candidateBottleIds: [bottle.id],
          matchedBottleId: bottle.id,
          identityScope: "exact_cask",
          referenceScope: "none",
          confidenceBasis: { webEvidence: "not_needed", unresolvedRisks: [] },
          observation: null,
          proposedBottle: null,
        },
        artifacts: { candidates: [candidate!] },
      }),
      modelMetadata,
    });
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(model).not.toHaveBeenCalled();
  expect(await db.query.bottleChecks.findMany()).toHaveLength(0);
  const requested = (await db.query.auctionLots.findFirst())!;
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(
    (await db.query.auctionLots.findFirst())?.sourceDetailsRequestedAt,
  ).toEqual(requested.sourceDetailsRequestedAt);
  expect(
    (await db.query.auctionLots.findFirst())?.sourceDetailsRequestedAt,
  ).not.toBeNull();
  const enqueue = vi.fn(async () => undefined);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue,
  });
  await lifecycle.queueRequestedAuctionLotDetails();
  const run = (await db.query.externalSiteRuns.findFirst())!;
  expect(
    ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor).lots,
  ).toHaveLength(1);
  await syncScraperDefinitions(scraperRegistry);
  const fetchImpl = vi.fn<typeof fetch>(
    async (input) =>
      new Response(
        (input instanceof Request ? input.url : input.toString()).endsWith(
          "/robots.txt",
        )
          ? "User-agent: *\nAllow: /"
          : detailHtml,
      ),
  );
  let now = new Date();
  await expect(
    executeScraperRun(
      { runId: run.id },
      {
        registry: scraperRegistry,
        fetchImpl,
        clock: {
          now: () => now,
          sleep: async (ms) => {
            now = new Date(now.getTime() + ms);
          },
          random: () => 0,
        },
      },
    ),
  ).resolves.toMatchObject({ status: "completed" });
  const enriched = (await db.query.auctionLots.findFirst())!;
  expect(enriched.sourceFingerprint).not.toBe(lot.sourceFingerprint);
  expect(enriched).toMatchObject({
    sourceDetailsRunId: run.id,
    matchStatus: "pending",
    matchCheckId: null,
    lastCheckedAt: lot.lastCheckedAt,
    state: "closed",
    sourceBottleIdentity: { cask_number: "3771", abv: 59, outturn: 633 },
  });
  await resolveAuctionLot(lot.id, enriched.sourceFingerprint);
  expect(model.mock.calls[0][0]).toMatchObject({
    readCandidateImages: false,
    extractedIdentitySource: "structured",
    extractedIdentity: { cask_number: "3771", abv: 59 },
  });
  expect(model).toHaveBeenCalledOnce();
  expect(await db.query.bottleChecks.findMany()).toHaveLength(1);
  expect(await db.query.auctionLotResults.findMany()).toHaveLength(1);
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: bottle.id,
    matchStatus: "matched",
  });
  await lifecycle.queueRequestedAuctionLotDetails();
  expect(enqueue).toHaveBeenCalledOnce();
});

test("enriching a previously reviewed lot preserves its saved check and result", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const lot = await importedLot(site.id);
  const { check } = await createBottleCheck({
    intent: "resolve_reference",
    sourceKind: "auction_lot",
    sourceId: lot.id,
    backgroundEventKey: auctionLotCheckKey(lot.id, lot.sourceFingerprint),
    input: { reference: { id: lot.id, name: lot.name, url: lot.url } },
    result: createDecidedBottleClassification({
      decision: {
        action: "no_match",
        rationale: "More detail needed.",
        candidateBottleIds: [],
        matchedBottleId: null,
        identityScope: "exact_cask",
        observation: null,
        proposedBottle: null,
      },
      artifacts: {},
    }),
  });
  const savedChecks = await db.query.bottleChecks.findMany();
  const model = vi.spyOn(classifier, "runScrapedBottleReference");
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(model).not.toHaveBeenCalled();
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  const request = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor)
    .lots[0];
  expect(request.expectedCheckId).toBe(check.id);
  expect(
    await saveAuctionLotDetails(site.id, {
      kind: "details",
      request,
      ...parseScotchWhiskyAuctionDetails(detailHtml),
      checkedAt: new Date().toISOString(),
    }),
  ).toMatchObject({ matchStatus: "pending", matchCheckId: null });
  expect(await db.query.bottleChecks.findMany()).toEqual(savedChecks);
  expect(await db.query.auctionLotResults.findMany()).toHaveLength(1);
});

test("detail cursor resumes after a request-budget wait and removed pages stay reviewable", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const first = await importedLot(site.id);
  const second = await importedLot(site.id, "893369");
  await requestReview(first);
  await requestReview(second);
  await syncScraperDefinitions(scraperRegistry);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  await db
    .update(externalSiteRuns)
    .set({ requestLimit: 2 })
    .where(eq(externalSiteRuns.id, run.id));
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const value = input instanceof Request ? input.url : input.toString();
    urls.push(value);
    if (value.endsWith("/robots.txt"))
      return new Response("User-agent: *\nAllow: /");
    if (value.includes("893369-"))
      return new Response("Removed", { status: 404 });
    return new Response(detailHtml);
  };
  let now = new Date();
  const clock = {
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    random: () => 0,
  };
  const waiting = await executeScraperRun(
    { runId: run.id },
    { registry: scraperRegistry, fetchImpl, clock },
  );
  expect(waiting.status).toBe("waiting");
  const saved = (await db.query.externalSiteRuns.findFirst())!;
  expect(
    ScotchWhiskyAuctionDetailsCursorSchema.parse(saved.cursor).lotIndex,
  ).toBe(1);
  await lifecycle.queueRequestedAuctionLotDetails();
  expect(await db.query.externalSiteRuns.findMany()).toHaveLength(1);
  if (waiting.status !== "waiting") throw new Error("Expected a planned wait.");
  now = waiting.nextAttemptAt;
  expect(
    await executeScraperRun(
      { runId: run.id },
      { registry: scraperRegistry, fetchImpl, clock },
    ),
  ).toMatchObject({ status: "completed" });
  expect(urls.filter((value) => value === first.url)).toHaveLength(1);
  expect(
    await db.query.auctionLots.findFirst({
      where: eq(auctionLots.id, second.id),
    }),
  ).toMatchObject({
    matchStatus: "review",
    sourceBottleIdentity: null,
    lastCheckedAt: second.lastCheckedAt,
  });
  expect(
    (
      await db.query.auctionLots.findFirst({
        where: eq(auctionLots.id, second.id),
      })
    )?.sourceDetailsCheckedAt,
  ).not.toBeNull();
});

test("only requested unresolved lots are batched, with at most 25 and no new run after terminal failure", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({
    type: "scotchwhiskyauctions",
    runEvery: null,
  });
  for (let i = 0; i < 27; i++)
    await requestReview(await importedLot(site.id, String(i + 1)));
  const untouched = await importedLot(site.id, "unrequested");
  await db
    .update(auctionLots)
    .set({ matchStatus: "review" })
    .where(eq(auctionLots.id, untouched.id));
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  const cursor = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor);
  expect(cursor.lots).toHaveLength(25);
  expect(cursor.lots.some(({ lotId }) => lotId === untouched.id)).toBe(false);
  await expect(lifecycle.queueAuctionDetailsRun(site.id)).rejects.toThrow(
    /already queued/,
  );
  await db
    .update(externalSiteRuns)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(externalSiteRuns.id, run.id));
  const second = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  expect(
    ScotchWhiskyAuctionDetailsCursorSchema.parse(second.cursor).lots,
  ).toHaveLength(2);
  await db
    .update(externalSiteRuns)
    .set({ status: "failed", completedAt: new Date() })
    .where(eq(externalSiteRuns.id, second.id));
  expect(await lifecycle.queueAuctionDetailsRun(site.id)).toBeNull();
  expect(await db.query.externalSiteRuns.findMany()).toHaveLength(2);
});

test("detail requests preserve assignments made while fetching and reject another source or changed title", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const foreign = await fixtures.ExternalSite();
  const lot = await importedLot(site.id);
  await requestReview(lot);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  const request = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor)
    .lots[0];
  const input = {
    kind: "details" as const,
    request,
    name,
    sourceBottleIdentity: null,
    volume: 750,
    checkedAt: new Date().toISOString(),
  };
  expect(await saveAuctionLotDetails(foreign.id, input)).toBeNull();
  const bottle = await fixtures.Bottle();
  await assignAuctionLot({
    lotId: lot.id,
    bottleId: bottle.id,
    fingerprint: lot.sourceFingerprint,
    expectedBottleId: null,
  });
  expect(await saveAuctionLotDetails(site.id, input)).toBeNull();
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    bottleId: bottle.id,
    matchStatus: "matched",
    volume: null,
  });
  const other = await importedLot(site.id, "893369");
  await requestReview(other);
  const current = (await db.query.auctionLots.findFirst({
    where: eq(auctionLots.id, other.id),
  }))!;
  expect(
    await saveAuctionLotDetails(site.id, {
      ...input,
      name: "Different release",
      request: {
        lotId: other.id,
        fingerprint: other.sourceFingerprint,
        expectedCheckId: null,
        requestedAt: current.sourceDetailsRequestedAt!.toISOString(),
        url: other.url,
      },
      checkedAt: new Date().toISOString(),
    }),
  ).toMatchObject({ volume: null, matchStatus: "review" });
});

test("detail replay recovers matching dispatch but cannot reuse a changed listing's request", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const lot = await importedLot(site.id);
  await requestReview(lot);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  const request = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor)
    .lots[0];
  const observation = {
    sourceKey: `details:${lot.id}:${lot.sourceFingerprint}`,
    value: {
      kind: "details" as const,
      request,
      ...parseScotchWhiskyAuctionDetails(detailHtml),
      checkedAt: new Date().toISOString(),
    },
  };
  pushUniqueJob.mockRejectedValueOnce(new Error("Queue unavailable"));
  await expect(
    auctionSink({ externalSiteId: site.id, observation }),
  ).rejects.toThrow(/Queue unavailable/);
  const saved = (await db.query.auctionLots.findFirst())!;
  expect(saved).toMatchObject({
    matchStatus: "pending",
    sourceDetailsRunId: run.id,
  });
  expect(saved.sourceFingerprint).not.toBe(lot.sourceFingerprint);
  await auctionSink({ externalSiteId: site.id, observation });
  expect(await db.query.auctionLots.findFirst()).toEqual(saved);
  expect(pushUniqueJob).toHaveBeenLastCalledWith("ApplyAuctionLotMatch", {
    lotId: lot.id,
    fingerprint: saved.sourceFingerprint,
  });
  expect(await db.query.auctionLotResults.findMany()).toHaveLength(1);

  await db
    .update(externalSiteRuns)
    .set({ status: "succeeded", completedAt: new Date() })
    .where(eq(externalSiteRuns.id, run.id));
  expect(await requestAuctionLotDetails(lot.id, saved.sourceFingerprint)).toBe(
    false,
  );
  expect(await lifecycle.queueAuctionDetailsRun(site.id)).toBeNull();
  expect(await db.query.auctionLots.findFirst()).toEqual(saved);

  const { lot: changed } = await upsertAuctionObservation(site.id, {
    auction: {
      sourceKey: "232",
      name: "The 183rd auction",
      url: "https://www.scotchwhiskyauctions.com/auctions/232-the-183rd-auction/",
    },
    lot: {
      sourceKey: lot.sourceKey,
      name: "Ardbeg 2009 14 Year Old Single Cask #3918 Feis Ile 2025",
      url: lot.url,
      state: "closed",
    },
    observedAt: new Date().toISOString(),
  });
  expect(changed.sourceFingerprint).not.toBe(saved.sourceFingerprint);
  expect(changed).toMatchObject({
    sourceDetailsRequestedAt: null,
    sourceDetailsCheckedAt: null,
    sourceDetailsRunId: null,
    sourceBottleIdentity: null,
  });
  expect(
    await requestAuctionLotDetails(lot.id, changed.sourceFingerprint),
  ).toBe(true);
  const requested = (await db.query.auctionLots.findFirst())!;
  expect(requested.sourceDetailsRequestedAt?.toISOString()).not.toBe(
    request.requestedAt,
  );
  expect(await saveAuctionLotDetails(site.id, observation.value)).toBeNull();
  const dispatchCount = pushUniqueJob.mock.calls.length;
  await auctionSink({ externalSiteId: site.id, observation });
  expect(pushUniqueJob).toHaveBeenCalledTimes(dispatchCount);
  expect(await db.query.auctionLots.findFirst()).toEqual(requested);
  expect(await db.query.auctionLotResults.findMany()).toHaveLength(1);

  const next = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  expect(next.id).not.toBe(run.id);
  const nextRequests = ScotchWhiskyAuctionDetailsCursorSchema.parse(
    next.cursor,
  ).lots;
  expect(nextRequests).toEqual([
    {
      lotId: lot.id,
      fingerprint: changed.sourceFingerprint,
      expectedCheckId: null,
      requestedAt: requested.sourceDetailsRequestedAt!.toISOString(),
      url: lot.url,
    },
  ]);
  const refreshed = await saveAuctionLotDetails(site.id, {
    ...observation.value,
    request: nextRequests[0],
    name: changed.name,
    sourceBottleIdentity: null,
    checkedAt: new Date().toISOString(),
  });
  expect(refreshed).toMatchObject({
    matchStatus: "pending",
    sourceDetailsRunId: next.id,
  });
  expect(refreshed?.sourceDetailsCheckedAt).not.toBeNull();
  expect(await saveAuctionLotDetails(site.id, observation.value)).toBeNull();
  await auctionSink({ externalSiteId: site.id, observation });
  expect(pushUniqueJob).toHaveBeenCalledTimes(dispatchCount);
  expect(await db.query.auctionLots.findFirst()).toEqual(refreshed);
});

test("explicit detail retry is admin-only, versioned, and invalidates an earlier in-flight request", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const lot = await importedLot(site.id);
  await requestReview(lot);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  const request = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor)
    .lots[0];
  const input = {
    refreshSourceDetails: true,
    lots: [
      {
        lotId: lot.id,
        fingerprint: lot.sourceFingerprint,
        expectedBottleId: null,
        expectedCheckId: null,
      },
    ],
  };
  const mod = await fixtures.User({ mod: true });
  await expect(
    routerClient.auctions.recheck(input, { context: { user: mod } }),
  ).rejects.toThrow();
  const admin = await fixtures.User({ admin: true });
  await expect(
    routerClient.auctions.recheck(
      { ...input, lots: [{ ...input.lots[0], fingerprint: "old" }] },
      { context: { user: admin } },
    ),
  ).rejects.toThrow(/changed/);
  expect(
    await routerClient.auctions.recheck(input, { context: { user: admin } }),
  ).toEqual({ queued: [lot.id], skipped: [] });
  expect(
    await saveAuctionLotDetails(site.id, {
      kind: "details",
      request,
      name,
      sourceBottleIdentity: null,
      volume: 700,
      checkedAt: new Date().toISOString(),
    }),
  ).toBeNull();
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    matchStatus: "review",
    sourceDetailsRunId: null,
    sourceDetailsCheckedAt: null,
  });
});

test("requested live lots are checked before older closed lots", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const closed = await importedLot(site.id);
  const live = await importedLot(site.id, "893369");
  await db
    .update(auctionLots)
    .set({ state: "live" })
    .where(eq(auctionLots.id, live.id));
  await requestReview(closed);
  await requestReview(live);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  expect(run.purpose).toBe("details");
  expect(
    ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor).lots.map(
      (lot) => lot.lotId,
    ),
  ).toEqual([live.id, closed.id]);
});

test.for(["success", "failure", "expired"] as const)(
  "detail run %s preserves the site's last listing refresh",
  async (outcome, { fixtures }) => {
    const site = await fixtures.ExternalSite({
      type: "scotchwhiskyauctions",
      runEvery: null,
    });
    const lot = await importedLot(site.id);
    await requestReview(lot);
    const completedAt = new Date(Date.now() - 30_000);
    const [collection] = await db
      .insert(externalSiteRuns)
      .values({
        externalSiteId: site.id,
        trigger: "manual",
        status: "failed",
        completedAt,
      })
      .returning();
    await db
      .update(externalSites)
      .set({ lastRunAt: completedAt, lastRunId: collection.id })
      .where(eq(externalSites.id, site.id));
    const lifecycle = createScraperLifecycle({
      registry: scraperRegistry,
      enqueue: async () => undefined,
    });
    const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
    if (outcome === "expired")
      await db
        .update(externalSiteRuns)
        .set({ createdAt: new Date(Date.now() - 7 * 24 * 60 * 60_000) })
        .where(eq(externalSiteRuns.id, run.id));
    await syncScraperDefinitions(scraperRegistry);
    let now = new Date();
    const execute = executeScraperRun(
      { runId: run.id },
      {
        registry: scraperRegistry,
        fetchImpl: async (input) =>
          new Response(
            (input instanceof Request ? input.url : input.toString()).endsWith(
              "/robots.txt",
            )
              ? "User-agent: *\nAllow: /"
              : outcome === "success"
                ? detailHtml
                : "Unexpected page",
          ),
        clock: {
          now: () => now,
          sleep: async (ms) => {
            now = new Date(now.getTime() + ms);
          },
          random: () => 0,
        },
      },
    );
    if (outcome !== "failure")
      await expect(execute).resolves.toMatchObject({ status: "completed" });
    else await expect(execute).rejects.toThrow();
    expect(await db.query.externalSites.findFirst()).toMatchObject({
      lastRunAt: completedAt,
      lastRunId: collection.id,
    });
  },
);

test("scheduled auction runs save current scope while manual runs keep recent collection", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({
    type: "scotchwhiskyauctions",
    runEvery: 240,
    nextRunAt: null,
  });
  const admin = await fixtures.User({ admin: true });
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const scheduled = (await lifecycle.queueScheduledExternalSiteRun(site.id))!;
  expect(scheduled).toMatchObject({
    purpose: "collect",
    cursor: { scope: "current", auctions: [] },
  });
  await db
    .update(externalSiteRuns)
    .set({ status: "succeeded", completedAt: new Date() })
    .where(eq(externalSiteRuns.id, scheduled.id));
  const manual = await lifecycle.queueManualExternalSiteRun({
    site,
    requestedById: admin.id,
  });
  expect(manual).toMatchObject({ purpose: "collect", cursor: null });
});

test("a removed detail page still allows a new lot's normal title check", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "scotchwhiskyauctions" });
  const lot = await importedLot(site.id);
  const model = vi
    .spyOn(classifier, "runScrapedBottleReference")
    .mockResolvedValue({
      result: createDecidedBottleClassification({
        decision: {
          action: "no_match",
          rationale: "The title does not establish an exact match.",
          candidateBottleIds: [],
          matchedBottleId: null,
          identityScope: "exact_cask",
          observation: null,
          proposedBottle: null,
        },
        artifacts: {},
      }),
      modelMetadata,
    });
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  const lifecycle = createScraperLifecycle({
    registry: scraperRegistry,
    enqueue: async () => undefined,
  });
  const run = (await lifecycle.queueAuctionDetailsRun(site.id))!;
  const request = ScotchWhiskyAuctionDetailsCursorSchema.parse(run.cursor)
    .lots[0];
  await saveAuctionLotDetails(site.id, {
    kind: "details",
    request,
    name: null,
    volume: null,
    sourceBottleIdentity: null,
    checkedAt: new Date().toISOString(),
  });
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(model).toHaveBeenCalledOnce();
  expect(await db.query.auctionLots.findFirst()).toMatchObject({
    matchStatus: "review",
    bottleId: null,
  });
  expect(await lifecycle.queueAuctionDetailsRun(site.id)).toBeNull();
});
