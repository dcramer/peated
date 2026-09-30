import {
  createDecidedBottleClassification,
  createIgnoredBottleClassification,
} from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import * as classifier from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db } from "@peated/server/db";
import { auctionLots, bottleChecks } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { afterEach, vi } from "vitest";
import { resolveAuctionLot } from "./auctionMatching";
import { upsertAuctionObservation } from "./auctions";

afterEach(() => vi.restoreAllMocks());

test("reuses an accepted reference without a new model decision", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const reference = await fixtures.BottleReference({
    name: normalizeBottleReferenceKey("Example 12 Year Old"),
    bottleId: bottle.id,
  });
  const site = await fixtures.ExternalSite();
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
  await resolveAuctionLot(lot.id, lot.sourceFingerprint);
  expect(run).not.toHaveBeenCalled();
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
  const site = await fixtures.ExternalSite();
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
});

test("ignored classifier output stays ignored after a retry", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite();
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
