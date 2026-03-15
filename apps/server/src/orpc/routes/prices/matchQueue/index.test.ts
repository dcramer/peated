import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  reviews,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("price match queue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.prices.matchQueue.list({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists pending and errored proposals", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const currentBottle = await fixtures.Bottle();
    const suggestedBottle = await fixtures.Bottle();
    const hiddenSite = await fixtures.ExternalSiteOrExisting({
      type: "healthyspirits",
    });

    const visiblePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Queue Candidate",
      bottleId: currentBottle.id,
    });
    const erroredPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Classifier Error",
    });
    const hiddenPrice = await fixtures.StorePrice({
      externalSiteId: hiddenSite.id,
      hidden: true,
      name: "Hidden Candidate",
    });

    const [pendingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: visiblePrice.id,
        status: "pending_review",
        proposalType: "correction",
        confidence: 62,
        currentBottleId: currentBottle.id,
        suggestedBottleId: suggestedBottle.id,
        candidateBottles: [
          {
            bottleId: suggestedBottle.id,
            fullName: suggestedBottle.fullName,
            alias: "Queue Candidate",
            brand: suggestedBottle.brandId?.toString() || null,
            score: 0.91,
            source: ["vector"],
          },
        ],
        rationale:
          "Name and OCR are close, but the current bottle looks wrong.",
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      })
      .returning();

    const [erroredProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: erroredPrice.id,
        status: "errored",
        proposalType: "no_match",
        error: "Classifier returned empty output",
        updatedAt: new Date("2026-03-08T11:00:00.000Z"),
      })
      .returning();

    await db.insert(storePriceMatchProposals).values({
      priceId: hiddenPrice.id,
      status: "pending_review",
      proposalType: "no_match",
    });

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(result.results).toHaveLength(2);
    expect(result.results.map((item) => item.id)).toEqual([
      erroredProposal.id,
      pendingProposal.id,
    ]);

    const queueItem = result.results.find(
      (item) => item.id === pendingProposal.id,
    );
    expect(queueItem).toMatchObject({
      proposalType: "correction",
      confidence: 62,
      price: {
        id: visiblePrice.id,
        name: "Queue Candidate",
        site: {
          id: site.id,
          name: site.name,
        },
      },
      currentBottle: {
        id: currentBottle.id,
        fullName: currentBottle.fullName,
      },
      suggestedBottle: {
        id: suggestedBottle.id,
        fullName: suggestedBottle.fullName,
      },
    });
  });

  test("filters queue items by kind and orders ties by newest id", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const currentBottle = await fixtures.Bottle();
    const firstCreatePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Create Candidate One",
      bottleId: null,
    });
    const secondCreatePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Create Candidate Two",
      bottleId: null,
    });
    const correctionPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Correction Candidate",
      bottleId: currentBottle.id,
    });
    const erroredPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Errored Candidate",
      bottleId: null,
    });
    const sharedUpdatedAt = new Date("2026-03-08T12:00:00.000Z");

    const [firstCreateProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: firstCreatePrice.id,
        status: "pending_review",
        proposalType: "create_new",
        updatedAt: sharedUpdatedAt,
      })
      .returning();

    const [secondCreateProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: secondCreatePrice.id,
        status: "pending_review",
        proposalType: "create_new",
        updatedAt: sharedUpdatedAt,
      })
      .returning();

    const [correctionProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: correctionPrice.id,
        status: "pending_review",
        proposalType: "correction",
        currentBottleId: currentBottle.id,
        updatedAt: new Date("2026-03-08T11:00:00.000Z"),
      })
      .returning();

    const [erroredProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: erroredPrice.id,
        status: "errored",
        proposalType: "no_match",
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      })
      .returning();

    const allResults = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const createResults = await routerClient.prices.matchQueue.list(
      { kind: "create_new" },
      { context: { user } },
    );
    const erroredResults = await routerClient.prices.matchQueue.list(
      { kind: "errored" },
      { context: { user } },
    );

    expect(allResults.results.map((item) => item.id)).toEqual([
      secondCreateProposal.id,
      firstCreateProposal.id,
      correctionProposal.id,
      erroredProposal.id,
    ]);
    expect(createResults.results.map((item) => item.id)).toEqual([
      secondCreateProposal.id,
      firstCreateProposal.id,
    ]);
    expect(erroredResults.results.map((item) => item.id)).toEqual([
      erroredProposal.id,
    ]);
  });

  test("separates actionable and processing queue items and returns counts", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const actionablePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Actionable Candidate",
    });
    const processingPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Processing Candidate",
    });
    const expiredPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Expired Lease Candidate",
    });
    const now = Date.now();

    const [actionableProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: actionablePrice.id,
        status: "pending_review",
        proposalType: "create_new",
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      })
      .returning();

    const [processingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: processingPrice.id,
        status: "pending_review",
        proposalType: "match_existing",
        processingToken: "processing-token",
        processingQueuedAt: new Date(now - 60_000),
        processingExpiresAt: new Date(now + 15 * 60_000),
        updatedAt: new Date("2026-03-08T09:00:00.000Z"),
      })
      .returning();

    const [expiredProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: expiredPrice.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "expired-token",
        processingQueuedAt: new Date(now - 30 * 60_000),
        processingExpiresAt: new Date(now - 5 * 60_000),
        updatedAt: new Date("2026-03-08T11:00:00.000Z"),
      })
      .returning();

    const actionableResults = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const processingResults = await routerClient.prices.matchQueue.list(
      { state: "processing" },
      { context: { user } },
    );

    expect(actionableResults.results.map((item) => item.id)).toEqual([
      expiredProposal.id,
      actionableProposal.id,
    ]);
    expect(actionableResults.stats).toEqual({
      actionableCount: 2,
      processingCount: 1,
    });
    expect(actionableResults.results.every((item) => !item.isProcessing)).toBe(
      true,
    );

    expect(processingResults.results.map((item) => item.id)).toEqual([
      processingProposal.id,
    ]);
    expect(processingResults.stats).toEqual({
      actionableCount: 2,
      processingCount: 1,
    });
    expect(processingResults.results[0]).toMatchObject({
      id: processingProposal.id,
      isProcessing: true,
    });
    expect(processingResults.results[0]?.processingQueuedAt).not.toBeNull();
    expect(processingResults.results[0]?.processingExpiresAt).not.toBeNull();
  });

  test("returns proposal details", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "astorwines" });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Unknown Dram",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        confidence: 88,
        extractedLabel: {
          brand: "Independent Brand",
          expression: "8 Year",
          category: "single_malt",
          stated_age: null,
          distillery: ["Ben Nevis"],
        },
        proposedBottle: {
          name: "Independent Brand 8 year",
          category: "single_malt",
          statedAge: null,
          brand: {
            name: "Independent Brand",
            type: ["brand"],
          },
          distillers: [
            {
              name: "Ben Nevis",
              type: ["distiller"],
            },
          ],
        },
        searchEvidence: [
          {
            query: 'site:astorwines.com "Unknown Dram"',
            results: [
              {
                title: "Unknown Dram - Astor Wines",
                url: "https://www.astorwines.com/example",
                description: "Retailer listing",
                extraSnippets: ["Single cask bottling"],
              },
            ],
          },
        ],
      })
      .returning();

    const result = await routerClient.prices.matchQueue.details(
      { proposal: proposal.id },
      { context: { user } },
    );

    expect(result).toMatchObject({
      id: proposal.id,
      proposalType: "create_new",
      price: {
        id: price.id,
        name: "Unknown Dram",
      },
      extractedLabel: {
        brand: "Independent Brand",
        expression: "8 Year",
        stated_age: null,
      },
      proposedBottle: {
        name: "8-year-old",
        statedAge: 8,
        brand: {
          name: "Independent Brand",
        },
      },
      searchEvidence: [
        {
          query: 'site:astorwines.com "Unknown Dram"',
        },
      ],
    });
  });

  test("approves a matched bottle and backfills related records", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ imageUrl: null });
    const site1 = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const site2 = await fixtures.ExternalSiteOrExisting({
      type: "reservebar",
    });
    const site3 = await fixtures.ExternalSiteOrExisting({
      type: "healthyspirits",
    });

    const price = await fixtures.StorePrice({
      externalSiteId: site1.id,
      name: "Queue Approval",
      bottleId: null,
      imageUrl: "https://example.com/price.jpg",
    });
    const siblingPrice = await fixtures.StorePrice({
      externalSiteId: site2.id,
      name: "Queue Approval",
      bottleId: null,
    });
    const ignoredSiblingPrice = await fixtures.StorePrice({
      externalSiteId: site3.id,
      name: "Queue Approval",
      bottleId: null,
    });
    const review = await fixtures.Review({
      externalSiteId: site1.id,
      name: "Queue Approval",
      bottleId: null,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: bottle.id,
      })
      .returning();
    const [siblingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: siblingPrice.id,
        status: "errored",
        proposalType: "no_match",
        error: "Classifier failed",
      })
      .returning();
    const [ignoredSiblingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: ignoredSiblingPrice.id,
        status: "ignored",
        proposalType: "no_match",
      })
      .returning();

    await routerClient.prices.matchQueue.resolve(
      {
        proposal: proposal.id,
        action: "match",
        bottle: bottle.id,
      },
      { context: { user } },
    );

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Queue Approval"),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const updatedSiblingPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, siblingPrice.id),
    });
    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    const updatedSiblingProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, siblingProposal.id),
      });
    const untouchedIgnoredProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, ignoredSiblingProposal.id),
      });
    const updatedBottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, bottle.id),
    });

    expect(alias?.bottleId).toBe(bottle.id);
    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(updatedSiblingPrice?.bottleId).toBe(bottle.id);
    expect(updatedReview?.bottleId).toBe(bottle.id);
    expect(updatedBottle?.imageUrl).toBe("https://example.com/price.jpg");
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: user.id,
    });
    expect(updatedSiblingProposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: user.id,
    });
    expect(untouchedIgnoredProposal).toMatchObject({
      status: "ignored",
      proposalType: "no_match",
      currentBottleId: null,
      suggestedBottleId: null,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("OnBottleAliasChange", {
      name: "Queue Approval",
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      {
        bottleId: bottle.id,
      },
    );
  });

  test("creates a bottle from a proposal and approves it atomically", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Queue Brand" });
    const site = await fixtures.ExternalSiteOrExisting({ type: "astorwines" });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Queue Create Candidate",
      bottleId: null,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
      })
      .returning();

    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        bottle: {
          name: "Single Cask",
          brand: brand.id,
        },
      },
      { context: { user } },
    );

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Queue Create Candidate"),
    });

    expect(result.fullName).toBe("Queue Brand Single Cask");
    expect(updatedPrice?.bottleId).toBe(result.id);
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: result.id,
      suggestedBottleId: result.id,
      reviewedById: user.id,
    });
    expect(listingAlias?.bottleId).toBe(result.id);
  });

  test("rolls back proposal-backed bottle creation when approval fails", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Rollback Brand" });

    const before = await db.select({ id: bottles.id }).from(bottles);

    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: 999999,
          bottle: {
            name: "Rollback Candidate",
            brand: brand.id,
          },
        },
        { context: { user } },
      ),
    );

    const after = await db.select({ id: bottles.id }).from(bottles);
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.fullName, "Rollback Brand Rollback Candidate"),
    });

    expect(err).toMatchInlineSnapshot(
      `[Error: Price match proposal not found (999999).]`,
    );
    expect(after).toHaveLength(before.length);
    expect(createdBottle).toBeUndefined();
  });

  test("rejects proposal-backed bottle creation for non-create_new proposals", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Mismatch Brand" });
    const price = await fixtures.StorePrice({
      name: "Existing Match Candidate",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: proposal.id,
          bottle: {
            name: "Should Not Exist",
            brand: brand.id,
          },
        },
        { context: { user } },
      ),
    );

    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.fullName, "Mismatch Brand Should Not Exist"),
    });

    expect(err).toMatchInlineSnapshot(
      `[Error: Price match proposal has invalid type (${proposal.id}, expected create_new, got match_existing).]`,
    );
    expect(createdBottle).toBeUndefined();
  });

  test("rejects proposal-backed bottle creation for closed proposals", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Closed Brand" });
    const price = await fixtures.StorePrice({
      name: "Closed Proposal Candidate",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "create_new",
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: proposal.id,
          bottle: {
            name: "Already Reviewed",
            brand: brand.id,
          },
        },
        { context: { user } },
      ),
    );

    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.fullName, "Closed Brand Already Reviewed"),
    });

    expect(err).toMatchInlineSnapshot(
      `[Error: Price match proposal is not reviewable (${proposal.id}, approved).]`,
    );
    expect(createdBottle).toBeUndefined();
  });

  test("returns a conflict when approving a match would overwrite another alias", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const existingBottle = await fixtures.Bottle();
    const targetBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Conflicting Alias",
      bottleId: null,
    });

    await fixtures.BottleAlias({
      bottleId: existingBottle.id,
      name: "Conflicting Alias",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: targetBottle.id,
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.resolve(
        {
          proposal: proposal.id,
          action: "match",
          bottle: targetBottle.id,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Duplicate alias found (${existingBottle.id}). Not implemented.]`,
    );
  });

  test("returns a conflict when proposal-backed bottle creation hits an alias collision", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const existingBottle = await fixtures.Bottle();
    const brand = await fixtures.Entity({ name: "Collision Brand" });
    const price = await fixtures.StorePrice({
      name: "Create Alias Collision",
      bottleId: null,
    });

    await fixtures.BottleAlias({
      bottleId: existingBottle.id,
      name: "Create Alias Collision",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: proposal.id,
          bottle: {
            name: "Fresh Release",
            brand: brand.id,
          },
        },
        { context: { user } },
      ),
    );
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.fullName, "Collision Brand Fresh Release"),
    });

    expect(err).toMatchInlineSnapshot(
      `[Error: Duplicate alias found (${existingBottle.id}). Not implemented.]`,
    );
    expect(createdBottle).toBeUndefined();
  });

  test("ignores a proposal", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
      })
      .returning();

    await routerClient.prices.matchQueue.resolve(
      {
        proposal: proposal.id,
        action: "ignore",
      },
      { context: { user } },
    );

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(updatedProposal).toMatchObject({
      status: "ignored",
      reviewedById: user.id,
    });
  });

  test("rejects resolving proposals that are already reviewed", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Closed Resolution Candidate",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "ignored",
        proposalType: "match_existing",
        suggestedBottleId: bottle.id,
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.resolve(
        {
          proposal: proposal.id,
          action: "match",
          bottle: bottle.id,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Price match proposal is not reviewable (${proposal.id}, ignored).]`,
    );
  });

  test("rejects resolving proposals that are currently processing", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Processing Resolution Candidate",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: bottle.id,
        processingToken: "active-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.resolve(
        {
          proposal: proposal.id,
          action: "match",
          bottle: bottle.id,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Price match proposal is currently processing (${proposal.id}).]`,
    );
  });

  test("requeues proposal evaluation", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
      })
      .returning();

    const result = await routerClient.prices.matchQueue.retry(
      { proposal: proposal.id },
      { context: { user } },
    );
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(result).toEqual({
      status: "queued",
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: price.id,
        force: true,
        processingToken: expect.any(String),
      },
    );
    expect(updatedProposal?.processingToken).toEqual(expect.any(String));
    expect(updatedProposal?.processingQueuedAt).not.toBeNull();
    expect(updatedProposal?.processingExpiresAt).not.toBeNull();
  });

  test("does not enqueue a retry for proposals already processing", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        processingToken: "active-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    const result = await routerClient.prices.matchQueue.retry(
      { proposal: proposal.id },
      { context: { user } },
    );

    expect(result).toEqual({
      status: "already_processing",
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("bulk requeues all actionable search results", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const [firstPrice, secondPrice, ignoredPrice] = await Promise.all([
      fixtures.StorePrice({
        externalSiteId: site.id,
        name: "SMWS Retry One",
      }),
      fixtures.StorePrice({
        externalSiteId: site.id,
        name: "SMWS Retry Two",
      }),
      fixtures.StorePrice({
        externalSiteId: site.id,
        name: "Different Search Result",
      }),
    ]);

    const [firstProposal, secondProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: firstPrice.id,
          status: "errored",
          proposalType: "no_match",
        },
        {
          priceId: secondPrice.id,
          status: "pending_review",
          proposalType: "create_new",
        },
      ])
      .returning();

    await db.insert(storePriceMatchProposals).values({
      priceId: ignoredPrice.id,
      status: "pending_review",
      proposalType: "create_new",
    });

    const result = await routerClient.prices.matchQueue.retryAll(
      { query: "SMWS Retry" },
      { context: { user } },
    );
    const updatedFirstProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, firstProposal.id),
      });
    const updatedSecondProposal =
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, secondProposal.id),
      });

    expect(result).toEqual({
      matchedCount: 2,
      enqueuedCount: 2,
      alreadyProcessingCount: 0,
      enqueueFailedCount: 0,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledTimes(2);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.objectContaining({
        priceId: firstPrice.id,
        force: true,
        processingToken: expect.any(String),
      }),
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.objectContaining({
        priceId: secondPrice.id,
        force: true,
        processingToken: expect.any(String),
      }),
    );
    expect(updatedFirstProposal?.processingToken).toEqual(expect.any(String));
    expect(updatedSecondProposal?.processingToken).toEqual(expect.any(String));
  });

  test("clears the processing lease if retry enqueue fails", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice();
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
      })
      .returning();
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("queue unavailable"),
    );

    const err = await waitError(
      routerClient.prices.matchQueue.retry(
        { proposal: proposal.id },
        { context: { user } },
      ),
    );
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(err).toMatchInlineSnapshot(`[Error: queue unavailable]`);
    expect(updatedProposal).toMatchObject({
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
  });
});
