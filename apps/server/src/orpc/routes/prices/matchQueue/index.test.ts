import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleChecks,
  bottleGroupDistillers,
  bottleGroups,
  bottleObservations,
  bottleOperations,
  bottleSeries,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
  incomingBottleDecisionLogs,
  reviews,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePriceMatchRetryRunItems,
  storePriceMatchRetryRuns,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { ProposedBottleSchema } from "@peated/server/schemas/priceMatches";
import { and, asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";

function completeProposedBottle(input: z.input<typeof ProposedBottleSchema>) {
  return ProposedBottleSchema.parse(input);
}

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

    const detailsError = await waitError(
      routerClient.prices.matchQueue.details(
        { proposal: 1 },
        { context: { user } },
      ),
    );
    expect(detailsError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);

    const resolveError = await waitError(
      routerClient.prices.matchQueue.resolve(
        { proposal: 1, action: "ignore" },
        { context: { user } },
      ),
    );
    expect(resolveError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);

    const applyError = await waitError(
      routerClient.prices.matchQueue.applyBottleRepair(
        { proposal: 1 },
        { context: { user } },
      ),
    );
    expect(applyError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);

    const beforeCreate = await Promise.all([
      db
        .select({ id: storePriceMatchProposals.id })
        .from(storePriceMatchProposals),
      db.select({ id: bottles.id }).from(bottles),
      db.select({ id: bottleGroups.id }).from(bottleGroups),
    ]);
    const createError = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: 1,
          independentBottle: {
            name: "Unauthorized Queue Create",
            brand: 1,
          },
        },
        { context: { user } },
      ),
    );

    expect(createError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    await expect(
      Promise.all([
        db
          .select({ id: storePriceMatchProposals.id })
          .from(storePriceMatchProposals),
        db.select({ id: bottles.id }).from(bottles),
        db.select({ id: bottleGroups.id }).from(bottleGroups),
      ]),
    ).resolves.toEqual(beforeCreate);
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
    expect(queueItem).not.toHaveProperty("currentBottleId");
    expect(queueItem).not.toHaveProperty("currentReleaseId");
    expect(queueItem).not.toHaveProperty("suggestedBottleId");
    expect(queueItem).not.toHaveProperty("suggestedReleaseId");
    expect(queueItem).not.toHaveProperty("parentBottle");
    expect(queueItem).not.toHaveProperty("parentBottleId");
    expect(queueItem).not.toHaveProperty("creationTarget");
    expect(queueItem).not.toHaveProperty("proposedRelease");
  });

  test("serializes Entity locations in relational Bottle queries", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottler = await fixtures.Entity({
      type: ["bottler"],
      location: [-3.2, 56.1],
    });
    const bottle = await fixtures.Bottle({ bottlerId: bottler.id });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Relational Geometry Candidate",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        currentBottleId: bottle.id,
      })
      .returning();

    const list = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const details = await routerClient.prices.matchQueue.details(
      { proposal: proposal.id },
      { context: { user } },
    );

    expect(list.results).toHaveLength(1);
    expect(list.results[0]).toMatchObject({
      id: proposal.id,
      currentBottle: {
        bottler: { id: bottler.id, location: [-3.2, 56.1] },
      },
    });
    expect(details).toMatchObject({
      id: proposal.id,
      currentBottle: {
        bottler: { id: bottler.id, location: [-3.2, 56.1] },
      },
    });
  });

  test("keeps a pending primary decision in Incoming Listings only", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice({ name: "Clean Linked Check" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();
    await db.insert(bottleChecks).values({
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: String(price.id),
      subjectKey: `resolve_reference:store_price:${price.id}`,
      schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
      inputSnapshot: {},
      output: {
        status: "classified",
        summary: "No supplemental catalog cleanup was found.",
        findings: [],
      },
      storePriceMatchProposalId: proposal.id,
      completedAt: new Date(),
    });

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ id: proposal.id });
    expect(result.stats.actionableCount).toBe(1);
    await expect(
      routerClient.audits.list(
        { source: "incoming_listing" },
        { context: { user } },
      ),
    ).resolves.toMatchObject({ results: [] });
  });

  test("moves supplemental work to Bottle Checks after the primary decision", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const sourceBottle = await fixtures.Bottle();
    const destinationBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: destinationBottle.id,
      name: "Supplemental Work",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        suggestedBottleId: destinationBottle.id,
      })
      .returning();
    const [check] = await db
      .insert(bottleChecks)
      .values({
        intent: "resolve_reference",
        sourceKind: "store_price",
        sourceId: String(price.id),
        subjectKey: `resolve_reference:store_price:${price.id}`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: {
          status: "classified",
          decision: {
            action: "match",
            rationale: "The listing matched, with catalog cleanup remaining.",
            candidateBottleIds: [destinationBottle.id],
            identityScope: "product",
            observation: null,
            matchedBottleId: destinationBottle.id,
            proposedBottle: null,
          },
          findings: [],
        },
        storePriceMatchProposalId: proposal.id,
        completedAt: new Date(),
      })
      .returning();
    await db.insert(bottleOperations).values({
      checkId: check.id,
      proposal: {
        type: "merge_bottles",
        input: {
          sourceBottleId: sourceBottle.id,
          destinationBottleId: destinationBottle.id,
        },
        rationale: "The Bottles are exact duplicates.",
        evidenceRefs: [
          { kind: "bottle", bottleId: sourceBottle.id },
          { kind: "bottle", bottleId: destinationBottle.id },
        ],
      },
      status: "pending_review",
    });

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(result.results).toEqual([]);
    expect(result.stats.actionableCount).toBe(0);
    await expect(
      routerClient.audits.list(
        { source: "incoming_listing" },
        { context: { user } },
      ),
    ).resolves.toMatchObject({
      results: [expect.objectContaining({ id: check.id })],
    });
  });

  test("removes a completed primary row after all linked supplemental work is done", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const sourceBottle = await fixtures.Bottle();
    const destinationBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({ name: "Completed Work" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        suggestedBottleId: destinationBottle.id,
      })
      .returning();
    const [check] = await db
      .insert(bottleChecks)
      .values({
        intent: "resolve_reference",
        sourceKind: "store_price",
        sourceId: String(price.id),
        subjectKey: `resolve_reference:store_price:${price.id}`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: {
          status: "classified",
          summary: "All supplemental cleanup is complete.",
          findings: [],
        },
        storePriceMatchProposalId: proposal.id,
        completedAt: new Date(),
      })
      .returning();
    await db.insert(bottleOperations).values({
      checkId: check.id,
      proposal: {
        type: "merge_bottles",
        input: {
          sourceBottleId: sourceBottle.id,
          destinationBottleId: destinationBottle.id,
        },
        rationale: "The Bottles were exact duplicates.",
        evidenceRefs: [
          { kind: "bottle", bottleId: sourceBottle.id },
          { kind: "bottle", bottleId: destinationBottle.id },
        ],
      },
      status: "applied",
      result: {
        type: "merge_bottles",
        status: "applied",
        sourceBottleId: sourceBottle.id,
        destinationBottleId: destinationBottle.id,
        changed: true,
      },
    });
    await db.insert(bottleChecks).values({
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: String(price.id),
      subjectKey: `resolve_reference:store_price:${price.id}`,
      schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
      inputSnapshot: {},
      output: {
        status: "classified",
        summary: "This finding was closed.",
        findings: [
          {
            scope: "other",
            summary: "No further action is required.",
            evidenceRefs: [{ kind: "source", field: "reference.name" }],
          },
        ],
      },
      storePriceMatchProposalId: proposal.id,
      closedById: user.id,
      closeReason: "dismissed",
      closedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(result.results).toEqual([]);
    expect(result.stats.actionableCount).toBe(0);
    await expect(
      routerClient.audits.list(
        { source: "incoming_listing" },
        { context: { user } },
      ),
    ).resolves.toMatchObject({ results: [] });
  });

  test("hydrates a direct Bottle suggestion", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Direct Suggestion" });
    const price = await fixtures.StorePrice({ name: "Direct Listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: bottle.id,
      })
      .returning();

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(
      result.results.find((item) => item.id === proposal.id)?.suggestedBottle,
    ).toMatchObject({ id: bottle.id });
  });

  test("discards historical candidate shapes", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Legacy Queue Candidate" });
    const price = await fixtures.StorePrice({ name: "Legacy Queue Listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        candidateBottles: [
          {
            kind: "bottle",
            bottleId: bottle.id,
            bottleFullName: bottle.fullName,
            fullName: bottle.fullName,
            source: ["legacy"],
            familyContext: {
              parentBottleReleaseTraits: ["edition"],
              siblingReleases: [{ fullName: "Legacy Release" }],
              siblingBottles: [],
            },
          },
          {
            kind: "release",
            bottleId: bottle.id,
            fullName: "Legacy Release",
            source: ["legacy"],
          },
        ],
      })
      .returning();

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const candidates = result.results.find(
      (item) => item.id === proposal.id,
    )?.candidateBottles;

    expect(candidates).toEqual([]);
  });

  test("serializes persisted BottleGroup sibling cask evidence", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const candidate = await fixtures.Bottle({
      name: "Grouped Cask Candidate",
      maturation: "Bourbon barrel",
      caskNumber: "#1234",
      outturn: 240,
    });
    if (candidate.groupId === null) {
      throw new Error("Expected candidate Bottle to belong to a BottleGroup.");
    }
    const sibling = await fixtures.BottleGroupMember({
      groupId: candidate.groupId,
      edition: "Sherry Sibling",
      maturation: "Oloroso hogshead",
      caskNumber: "#9012",
      outturn: 200,
    });
    const price = await fixtures.StorePrice({
      name: "Grouped Cask Candidate Listing",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: candidate.id,
        candidateBottles: [
          {
            bottleId: candidate.id,
            fullName: candidate.fullName,
            maturation: "Bourbon barrel",
            caskNumber: "#1234",
            outturn: 240,
            source: ["current"],
            familyContext: {
              siblingBottles: [
                {
                  bottleId: sibling.id,
                  fullName: sibling.fullName,
                  traitFields: [
                    "edition",
                    "maturation",
                    "caskNumber",
                    "outturn",
                  ],
                  edition: "Sherry Sibling",
                  maturation: "Oloroso hogshead",
                  caskNumber: "#9012",
                  outturn: 200,
                },
              ],
            },
          },
        ],
      })
      .returning();

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(
      result.results.find((item) => item.id === proposal.id)?.candidateBottles,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: candidate.id,
          maturation: "Bourbon barrel",
          caskNumber: "#1234",
          outturn: 240,
          familyContext: expect.objectContaining({
            siblingBottles: [
              expect.objectContaining({
                bottleId: sibling.id,
                maturation: "Oloroso hogshead",
                caskNumber: "#9012",
                outturn: 200,
                traitFields: expect.arrayContaining([
                  "maturation",
                  "caskNumber",
                  "outturn",
                ]),
              }),
            ],
          }),
        }),
      ]),
    );
  });

  test("hydrates the authoritative current Bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Legacy Parent" });
    const price = await fixtures.StorePrice({ name: "Promoted Listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        currentBottleId: parent.id,
      })
      .returning();

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    expect(
      result.results.find((item) => item.id === proposal.id)?.currentBottle,
    ).toMatchObject({
      id: parent.id,
    });
  });

  test("hydrates persisted direct Bottle evidence even after retirement", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Retired Queue Target" });
    const replacement = await fixtures.Bottle({
      name: "Queue Target Replacement",
    });
    const price = await fixtures.StorePrice({ name: "Invalid Target Listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        currentBottleId: bottle.id,
      })
      .returning();
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const [listResult, detailsResult] = await Promise.all([
      routerClient.prices.matchQueue.list({}, { context: { user } }),
      routerClient.prices.matchQueue.details(
        { proposal: proposal.id },
        { context: { user } },
      ),
    ]);

    expect(
      listResult.results.find((item) => item.id === proposal.id),
    ).toMatchObject({ currentBottle: { id: bottle.id } });
    expect(detailsResult).toMatchObject({
      currentBottle: { id: bottle.id },
    });
  });

  test("renders a persisted automation assessment snapshot when present", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const currentBottle = await fixtures.Bottle();
    const suggestedBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Persisted Snapshot Candidate",
      bottleId: currentBottle.id,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        confidence: 62,
        currentBottleId: currentBottle.id,
        suggestedBottleId: suggestedBottle.id,
        automationAssessment: {
          modelConfidence: 62,
          automationScore: 17,
          automationEligible: false,
          automationBlockers: ["persisted blocker"],
          decisiveMatchAttributes: ["name"],
          plainAgeBottleAutoVerifyEligible: false,
          differentiatingAttributes: ["distillery"],
          webEvidenceChecks: [
            {
              attribute: "distillery",
              expectedValue: "Persisted Distillery",
              required: true,
              validated: true,
              weaklySupported: false,
              matchedSourceTiers: ["official"],
              matchedSourceUrls: ["https://example.com/evidence"],
            },
          ],
        },
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      })
      .returning();
    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const queueItem = result.results.find((item) => item.id === proposal.id);

    expect(queueItem).toMatchObject({
      automationScore: 17,
      automationBlockers: expect.arrayContaining(["persisted blocker"]),
      differentiatingAttributes: expect.arrayContaining(["distillery"]),
      webEvidenceChecks: expect.arrayContaining([
        expect.objectContaining({
          attribute: "distillery",
          expectedValue: "Persisted Distillery",
        }),
      ]),
    });
  });

  test("computes legacy automation assessments without mutating on queue reads", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const brand = await fixtures.Entity({
      name: "The Whistler",
      type: ["brand", "bottler"],
    });
    const currentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bodega Cask",
      category: "blend",
      distillerIds: [],
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "The Whistler Bodega Cask Single Malt Irish Whiskey",
      bottleId: currentBottle.id,
      url: "https://www.totalwine.com/example",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        confidence: 92,
        currentBottleId: currentBottle.id,
        suggestedBottleId: currentBottle.id,
        candidateBottles: [
          {
            bottleId: currentBottle.id,
            fullName: currentBottle.fullName,
            alias: "The Whistler Bodega Cask",
            brand: "The Whistler",
            bottler: "The Whistler",
            distillery: [],
            category: "blend",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            maturation: null,
            caskNumber: null,
            outturn: null,
            score: 0.94,
            source: ["current", "exact"],
          },
        ],
        extractedLabel: {
          brand: "The Whistler",
          bottler: null,
          expression: "Bodega Cask",
          series: null,
          distillery: ["Boann Distillery"],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          maturation: null,
          cask_number: null,
          outturn: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        proposedBottle: {
          name: "Bodega Cask",
          brand: {
            id: brand.id,
            name: "The Whistler",
          },
          bottler: {
            id: brand.id,
            name: "The Whistler",
          },
          distillers: [
            {
              id: null,
              name: "Boann Distillery",
            },
          ],
          series: null,
          category: "single_malt",
          statedAge: null,
          edition: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          maturation: null,
          caskNumber: null,
          outturn: null,
        },
        searchEvidence: [
          {
            query: "Whistler Bodega Cask distillery",
            summary: "Boann Distillery produces The Whistler range.",
            results: [
              {
                title: "The Whistler Distillery Collection",
                url: "https://www.example.com/whistler-bodega-cask",
                domain: "example.com",
                description: "Distilled at Boann Distillery.",
                extraSnippets: [],
              },
            ],
          },
        ],
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      })
      .returning();

    expect(proposal.automationAssessment).toBeNull();

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );

    const persistedProposal = await db.query.storePriceMatchProposals.findFirst(
      {
        where: eq(storePriceMatchProposals.id, proposal.id),
      },
    );

    expect(
      result.results.find((item) => item.id === proposal.id),
    ).toMatchObject({
      modelConfidence: 92,
      differentiatingAttributes: expect.arrayContaining(["distillery"]),
    });
    expect(persistedProposal?.automationAssessment).toBeNull();
  });

  test("serializes same-bottle correction proposals with repair drafts", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const brand = await fixtures.Entity({
      name: "The Whistler",
      type: ["brand", "bottler"],
    });
    const currentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bodega Cask",
      category: "blend",
      edition: "Port Pipe",
      abv: 46,
      caskStrength: true,
      releaseYear: 2020,
      distillerIds: [],
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "The Whistler Bodega Cask Single Malt Irish Whiskey",
      bottleId: currentBottle.id,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        confidence: 92,
        currentBottleId: currentBottle.id,
        suggestedBottleId: currentBottle.id,
        candidateBottles: [
          {
            bottleId: currentBottle.id,
            fullName: currentBottle.fullName,
            alias: currentBottle.fullName,
            brand: "The Whistler",
            bottler: null,
            series: null,
            distillery: [],
            category: "blend",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            maturation: null,
            caskNumber: null,
            outturn: null,
            score: 0.99,
            source: ["exact"],
          },
        ],
        extractedLabel: {
          brand: "The Whistler",
          bottler: null,
          expression: "Bodega Cask",
          series: null,
          distillery: ["Boann Distillery"],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          maturation: null,
          cask_number: null,
          outturn: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        proposedBottle: {
          name: "Bodega Cask",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          maturation: "Bourbon barrel",
          caskNumber: "#1234",
          outturn: 240,
          brand: {
            id: brand.id,
            name: "The Whistler",
          },
          distillers: [
            {
              id: null,
              name: "Boann Distillery",
            },
          ],
          bottler: null,
        },
        searchEvidence: [
          {
            provider: "openai",
            query: '"The Whistler Bodega Cask" single malt',
            summary:
              "Official and critic sources describe The Whistler Bodega Cask as a single malt from Boann Distillery.",
            results: [
              {
                title:
                  "Whiskey Review: The Whistler Bodega Cask Irish Single Malt",
                url: "https://thewhiskeywash.com/reviews/whiskey-review-the-whistler-bodega-cask-irish-single-malt/",
                domain: "thewhiskeywash.com",
                description:
                  "Reviewing The Whistler Bodega Cask Irish Single Malt.",
                extraSnippets: [],
              },
            ],
          },
        ],
        rationale:
          "The current bottle appears to be the right base identity, but its stored bottle metadata conflicts with the extracted traits.",
      })
      .returning();

    const result = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const queueItem = result.results.find((item) => item.id === proposal.id);

    expect(queueItem).toMatchObject({
      proposalType: "correction",
      currentBottle: {
        id: currentBottle.id,
      },
      suggestedBottle: {
        id: currentBottle.id,
      },
      proposedBottle: {
        name: "Bodega Cask",
        category: "single_malt",
        maturation: "Bourbon barrel",
        caskNumber: "#1234",
        outturn: 240,
        distillers: [
          {
            name: "Boann Distillery",
          },
        ],
      },
      differentiatingAttributes: expect.arrayContaining(["distillery"]),
      webEvidenceChecks: expect.arrayContaining([
        expect.objectContaining({
          attribute: "distillery",
          expectedValue: "Boann Distillery",
        }),
      ]),
    });
  });

  test("applies same-bottle repair drafts and approves the listing", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const brand = await fixtures.Entity({
      name: "The Whistler",
      type: ["brand", "bottler"],
    });
    const distillery = await fixtures.Entity({
      name: "Boann Distillery",
      type: ["distiller"],
    });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Legacy",
    });
    const targetSeries = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Bodega",
    });
    const currentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bodega Cask",
      seriesId: sourceSeries.id,
      category: "blend",
      statedAge: 12,
      bottlerId: brand.id,
      edition: "Port Pipe",
      abv: 46,
      caskStrength: true,
      releaseYear: 2020,
      distillerIds: [distillery.id],
    });
    const sibling = await fixtures.BottleGroupMember({
      groupId: currentBottle.groupId!,
      edition: "Batch 2",
      statedAge: 14,
      abv: 50,
      caskStrength: true,
      releaseYear: 2021,
    });
    const siblingId = sibling.id;
    await db
      .update(bottleSeries)
      .set({ numReleases: 2 })
      .where(eq(bottleSeries.id, sourceSeries.id));
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "The Whistler Bodega Cask Single Malt Irish Whiskey",
      bottleId: currentBottle.id,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        confidence: 92,
        currentBottleId: currentBottle.id,
        suggestedBottleId: currentBottle.id,
        aliasScope: "global_alias",
        candidateBottles: [
          {
            bottleId: currentBottle.id,
            fullName: currentBottle.fullName,
            alias: currentBottle.fullName,
            brand: "The Whistler",
            bottler: null,
            series: null,
            distillery: [],
            category: "blend",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            maturation: null,
            caskNumber: null,
            outturn: null,
            score: 0.99,
            source: ["exact"],
          },
        ],
        extractedLabel: {
          brand: "The Whistler",
          bottler: null,
          expression: "Bodega Cask",
          series: null,
          distillery: ["Boann Distillery"],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          maturation: null,
          cask_number: null,
          outturn: null,
          cask_strength: null,
          single_cask: null,
          edition: "Bodega Review",
        },
        proposedBottle: {
          name: "Bodega Cask",
          series: {
            id: targetSeries.id,
            name: targetSeries.name,
          },
          category: "single_malt",
          edition: "Bodega Review",
          statedAge: null,
          caskStrength: false,
          singleCask: null,
          abv: 0,
          vintageYear: null,
          releaseYear: null,
          maturation: null,
          caskNumber: null,
          outturn: null,
          brand: {
            id: brand.id,
            name: "The Whistler",
          },
          distillers: [],
          bottler: null,
        },
        rationale:
          "The current bottle appears to be the right base identity, but its stored bottle metadata conflicts with the extracted traits.",
      })
      .returning();

    const result = await routerClient.prices.matchQueue.applyBottleRepair(
      { proposal: proposal.id },
      { context: { user } },
    );

    expect(result).toMatchObject({
      id: currentBottle.id,
      category: "single_malt",
      edition: "Bodega Review",
      abv: 0,
      caskStrength: false,
      distillers: [
        {
          id: distillery.id,
          name: "Boann Distillery",
        },
      ],
    });

    const [
      updatedGroup,
      updatedBottle,
      updatedSibling,
      updatedPrice,
      updatedProposal,
      memberDistillerRows,
      groupDistillerRows,
      updatedSourceSeries,
      updatedTargetSeries,
      repairChanges,
    ] = await Promise.all([
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, currentBottle.groupId!),
      }),
      db.query.bottles.findFirst({
        where: eq(bottles.id, currentBottle.id),
      }),
      db.query.bottles.findFirst({
        where: eq(bottles.id, siblingId),
      }),
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db
        .select()
        .from(bottlesToDistillers)
        .where(
          inArray(bottlesToDistillers.bottleId, [currentBottle.id, siblingId]),
        )
        .orderBy(
          asc(bottlesToDistillers.bottleId),
          asc(bottlesToDistillers.distillerId),
        ),
      db.query.bottleGroupDistillers.findMany({
        where: eq(bottleGroupDistillers.groupId, currentBottle.groupId!),
      }),
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, sourceSeries.id),
      }),
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, targetSeries.id),
      }),
      db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.type, "update"),
            inArray(changes.objectId, [currentBottle.id, siblingId]),
          ),
        )
        .orderBy(asc(changes.objectId)),
    ]);

    expect(updatedGroup).toMatchObject({
      id: currentBottle.groupId,
      name: "Bodega Cask",
      seriesId: targetSeries.id,
      category: "single_malt",
      statedAge: 12,
      bottlerId: brand.id,
    });
    expect(updatedBottle).toMatchObject({
      id: currentBottle.id,
      groupId: currentBottle.groupId,
      seriesId: targetSeries.id,
      category: "single_malt",
      statedAge: 12,
      bottlerId: brand.id,
      edition: "Bodega Review",
      abv: 0,
      caskStrength: false,
      releaseYear: 2020,
    });
    expect(updatedSibling).toMatchObject({
      id: siblingId,
      groupId: currentBottle.groupId,
      seriesId: targetSeries.id,
      category: "single_malt",
      statedAge: 14,
      bottlerId: brand.id,
      edition: "Batch 2",
      abv: 50,
      caskStrength: true,
      releaseYear: 2021,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: currentBottle.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      proposalType: "correction",
      currentBottleId: currentBottle.id,
      suggestedBottleId: currentBottle.id,
      reviewedById: user.id,
    });
    expect(memberDistillerRows).toEqual([
      expect.objectContaining({
        bottleId: currentBottle.id,
        distillerId: distillery.id,
      }),
      expect.objectContaining({
        bottleId: siblingId,
        distillerId: distillery.id,
      }),
    ]);
    expect(groupDistillerRows.map((row) => row.distillerId)).toEqual([
      distillery.id,
    ]);
    expect(updatedSourceSeries?.numReleases).toEqual(0);
    expect(updatedTargetSeries?.numReleases).toEqual(2);
    const actorId = (await getUserActor(user)).id;
    expect(repairChanges).toHaveLength(2);
    expect(repairChanges).toEqual([
      expect.objectContaining({
        objectId: currentBottle.id,
        actorId,
        data: expect.objectContaining({
          creationSource: "price_match_review",
          updateScope: "mixed",
          groupId: currentBottle.groupId,
          requestedBottleId: currentBottle.id,
        }),
      }),
      expect.objectContaining({
        objectId: siblingId,
        actorId,
        data: expect.objectContaining({
          creationSource: "price_match_review",
          updateScope: "shared",
          groupId: currentBottle.groupId,
          requestedBottleId: currentBottle.id,
        }),
      }),
    ]);

    const observation = await db.query.bottleObservations.findFirst({
      where: (bottleObservations, { eq }) =>
        eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    expect(observation).toMatchObject({
      bottleId: currentBottle.id,
      facts: expect.objectContaining({
        proposalType: "correction",
        proposedBottle: expect.objectContaining({
          category: "single_malt",
        }),
      }),
    });
    expect(listingAlias).toMatchObject({
      bottleId: currentBottle.id,
    });
  });

  test("rejects repair approval when the suggested Bottle changed", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const selected = await fixtures.Bottle({ name: "Repair Target Owner" });
    const other = await fixtures.Bottle({ name: "Repair Target Drift" });
    const cases = [
      { name: "Bottle suggestion drift", suggestedBottleId: other.id },
    ];

    for (const testCase of cases) {
      const price = await fixtures.StorePrice({
        bottleId: selected.id,
        name: `Repair ${testCase.name}`,
      });
      const [proposal] = await db
        .insert(storePriceMatchProposals)
        .values({
          priceId: price.id,
          status: "pending_review",
          proposalType: "correction",
          currentBottleId: selected.id,
          suggestedBottleId: testCase.suggestedBottleId,
          proposedBottle: {
            name: selected.name,
            brand: {
              id: selected.brandId,
              name: "Repair Target Brand",
            },
          },
        })
        .returning();

      const error = await waitError(
        routerClient.prices.matchQueue.applyBottleRepair(
          { proposal: proposal.id },
          { context: { user } },
        ),
      );

      expect(error, testCase.name).toMatchObject({ status: 400 });
      expect(
        await db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        }),
        testCase.name,
      ).toMatchObject({ status: "pending_review" });
    }
  });

  test("rolls back the repair and proposal approval when shared fanout conflicts", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const brand = await fixtures.Entity({
      name: "Repair Collision Brand",
      type: ["brand"],
    });
    const selected = await fixtures.Bottle({
      brandId: brand.id,
      name: "Repair Collision Source",
      category: "blend",
    });
    const sibling = await fixtures.BottleGroupMember({
      groupId: selected.groupId!,
      edition: "Batch 2",
      abv: 50,
    });
    const conflicting = await fixtures.Bottle({
      brandId: brand.id,
      name: "External Conflict Owner",
    });
    await fixtures.BottleAlias({
      bottleId: conflicting.id,
      name: sibling.fullName.replace(
        "Repair Collision Source",
        "Repair Collision Target",
      ),
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Repair Collision Listing",
      bottleId: selected.id,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        currentBottleId: selected.id,
        suggestedBottleId: selected.id,
        proposedBottle: {
          name: "Repair Collision Target",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          maturation: null,
          caskNumber: null,
          outturn: null,
          brand: { id: brand.id, name: brand.name },
          distillers: [],
          bottler: null,
        },
      })
      .returning();

    const memberIds = [selected.id, sibling.id];
    const [groupBefore, membersBefore, aliasesBefore] = await Promise.all([
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, selected.groupId!),
      }),
      db
        .select()
        .from(bottles)
        .where(inArray(bottles.id, memberIds))
        .orderBy(asc(bottles.id)),
      db.select().from(bottleAliases).orderBy(asc(bottleAliases.name)),
    ]);

    const error = await waitError(
      routerClient.prices.matchQueue.applyBottleRepair(
        { proposal: proposal.id },
        { context: { user } },
      ),
    );
    expect(error).toMatchObject({
      status: 409,
      data: { bottle: conflicting.id },
    });

    const [
      groupAfter,
      membersAfter,
      aliasesAfter,
      proposalAfter,
      priceAfter,
      observation,
      repairChanges,
    ] = await Promise.all([
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, selected.groupId!),
      }),
      db
        .select()
        .from(bottles)
        .where(inArray(bottles.id, memberIds))
        .orderBy(asc(bottles.id)),
      db.select().from(bottleAliases).orderBy(asc(bottleAliases.name)),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
      db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
      }),
      db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.type, "update"),
            inArray(changes.objectId, memberIds),
          ),
        ),
    ]);

    expect(groupAfter).toEqual(groupBefore);
    expect(membersAfter).toEqual(membersBefore);
    expect(aliasesAfter).toEqual(aliasesBefore);
    expect(proposalAfter).toMatchObject({
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
    });
    expect(priceAfter).toMatchObject({
      bottleId: selected.id,
    });
    expect(observation).toBeUndefined();
    expect(repairChanges).toEqual([]);
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

  test("filters queue items and counts by site", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const missionLiquor = await fixtures.ExternalSiteOrExisting({
      type: "missionliquor",
    });
    const whiskyWorld = await fixtures.ExternalSiteOrExisting({
      type: "whiskyworld",
    });
    const [missionPrice, whiskyWorldPrice] = await Promise.all([
      fixtures.StorePrice({ externalSiteId: missionLiquor.id }),
      fixtures.StorePrice({ externalSiteId: whiskyWorld.id }),
    ]);
    const [missionProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: missionPrice.id,
          status: "errored",
          proposalType: "no_match",
        },
        {
          priceId: whiskyWorldPrice.id,
          status: "errored",
          proposalType: "no_match",
        },
      ])
      .returning();

    const result = await routerClient.prices.matchQueue.list(
      { kind: "errored", site: "missionliquor" },
      { context: { user } },
    );

    expect(result.results.map((item) => item.id)).toEqual([
      missionProposal!.id,
    ]);
    expect(result.stats).toEqual({
      actionableCount: 1,
      processingCount: 0,
    });
  });

  test("sorts queue items by queue age when requested", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const oldestPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Oldest Queue Candidate",
    });
    const middlePrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Middle Queue Candidate",
    });
    const newestPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Newest Queue Candidate",
    });

    const [oldestProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: oldestPrice.id,
        status: "pending_review",
        proposalType: "create_new",
        createdAt: new Date("2026-03-08T08:00:00.000Z"),
        updatedAt: new Date("2026-03-08T11:00:00.000Z"),
      })
      .returning();

    const [middleProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: middlePrice.id,
        status: "pending_review",
        proposalType: "match_existing",
        createdAt: new Date("2026-03-08T09:00:00.000Z"),
        updatedAt: new Date("2026-03-08T10:00:00.000Z"),
      })
      .returning();

    const [newestProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: newestPrice.id,
        status: "pending_review",
        proposalType: "correction",
        createdAt: new Date("2026-03-08T10:00:00.000Z"),
        updatedAt: new Date("2026-03-08T09:00:00.000Z"),
      })
      .returning();

    const oldestFirstResults = await routerClient.prices.matchQueue.list(
      { sort: "created" },
      { context: { user } },
    );
    const newestFirstResults = await routerClient.prices.matchQueue.list(
      { sort: "-created" },
      { context: { user } },
    );

    expect(oldestFirstResults.results.map((item) => item.id)).toEqual([
      oldestProposal.id,
      middleProposal.id,
      newestProposal.id,
    ]);
    expect(newestFirstResults.results.map((item) => item.id)).toEqual([
      newestProposal.id,
      middleProposal.id,
      oldestProposal.id,
    ]);
  });

  test("formats structured classifier errors into readable automation blockers", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Broken Image Candidate",
    });

    await db.insert(storePriceMatchProposals).values({
      priceId: price.id,
      status: "errored",
      proposalType: "no_match",
      error: JSON.stringify([
        {
          code: "invalid_format",
          format: "url",
          path: ["reference", "imageUrl"],
          message: "Invalid URL",
        },
      ]),
      updatedAt: new Date("2026-03-08T10:00:00.000Z"),
    });

    const results = await routerClient.prices.matchQueue.list(
      { kind: "errored" },
      { context: { user } },
    );

    expect(results.results[0]?.automationBlockers).toContain(
      "reference image URL is invalid",
    );
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

  test("approves a matched bottle without cross-site fanout", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      imageUrl: null,
      rejectedImageUrls: ["https://example.com/other-price.jpg"],
    });
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
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
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
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    const updatedAttempt = await db.query.storePriceMatchAttempts.findFirst({
      where: eq(storePriceMatchAttempts.id, attempt.id),
    });
    const userActor = await getUserActor(user);

    expect(alias).toBeUndefined();
    expect(decisionLog).toMatchObject({
      actorId: userActor.id,
      decision: "match_existing",
      bottleId: bottle.id,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: bottle.id,
    });
    expect(updatedSiblingPrice?.bottleId).toBeNull();
    expect(updatedReview?.bottleId).toBeNull();
    expect(updatedBottle?.imageUrl).toBe("https://example.com/price.jpg");
    expect(updatedBottle?.rejectedImageUrls).toEqual([
      "https://example.com/other-price.jpg",
    ]);
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: user.id,
    });
    expect(updatedAttempt).toMatchObject({
      finalStatus: "approved",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
    });
    expect(updatedSiblingProposal).toMatchObject({
      status: "errored",
      proposalType: "no_match",
      currentBottleId: null,
      suggestedBottleId: null,
    });
    expect(untouchedIgnoredProposal).toMatchObject({
      status: "ignored",
      proposalType: "no_match",
      currentBottleId: null,
      suggestedBottleId: null,
    });
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "IndexBottleAlias",
      expect.anything(),
    );
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "OnBottleAliasChange",
      expect.anything(),
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      expect.anything(),
    );
  });

  test("approves one StorePrice when its title is a BottleAlias for another Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const generalBottle = await fixtures.Bottle({ name: "General Edition" });
    const exactBottle = await fixtures.Bottle({ name: "Exact Edition" });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Shared Store Title",
      bottleId: null,
    });
    const siblingPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: price.name,
      bottleId: null,
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      name: price.name,
      bottleId: null,
    });
    const existingAlias = await fixtures.BottleAlias({
      bottleId: generalBottle.id,
      name: price.name,
      assignmentSource: "human_approved",
      ignored: false,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "none",
        suggestedBottleId: exactBottle.id,
      })
      .returning();

    await routerClient.prices.matchQueue.resolve(
      {
        proposal: proposal.id,
        action: "match",
        bottle: exactBottle.id,
      },
      { context: { user } },
    );

    const [
      updatedPrice,
      updatedSiblingPrice,
      updatedReview,
      unchangedAlias,
      updatedProposal,
      observation,
      decisionLog,
    ] = await Promise.all([
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, siblingPrice.id),
      }),
      db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, price.name),
      }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
      }),
      db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
          eq(incomingBottleDecisionLogs.sourceId, price.id),
        ),
      }),
    ]);

    expect(updatedPrice?.bottleId).toBe(exactBottle.id);
    expect(updatedSiblingPrice?.bottleId).toBeNull();
    expect(updatedReview?.bottleId).toBeNull();
    expect(unchangedAlias).toMatchObject({
      bottleId: generalBottle.id,
      ignored: false,
      assignmentSource: "human_approved",
      assignedByActorId: existingAlias.assignedByActorId,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: exactBottle.id,
      suggestedBottleId: exactBottle.id,
    });
    expect(observation).toMatchObject({
      bottleId: exactBottle.id,
      facts: expect.objectContaining({ aliasScope: "none" }),
    });
    expect(decisionLog).toMatchObject({
      proposalId: proposal.id,
      bottleId: exactBottle.id,
      decision: "match_existing",
      metadata: expect.objectContaining({ aliasScope: "none" }),
    });
  });

  test("does not restore an image removed before approval", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const imageUrl = "https://example.com/removed-price.jpg";
    const bottle = await fixtures.Bottle({ imageUrl });
    const site = await fixtures.ExternalSite();
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Removed Image Approval",
      bottleId: null,
      imageUrl,
    });
    const review = await fixtures.Review({
      externalSiteId: site.id,
      name: "Removed Image Approval",
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

    await routerClient.bottles.update(
      { bottle: bottle.id, image: null },
      { context: { user } },
    );
    await routerClient.prices.matchQueue.resolve(
      {
        proposal: proposal.id,
        action: "match",
        bottle: bottle.id,
      },
      { context: { user } },
    );

    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({
      imageUrl: null,
      rejectedImageUrls: [imageUrl],
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
    ).toMatchObject({ status: "approved", currentBottleId: bottle.id });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Removed Image Approval"),
      }),
    ).toBeUndefined();
  });

  test("records moderation history when approving the current Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Already Assigned Queue Approval",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        currentBottleId: bottle.id,
        suggestedBottleId: bottle.id,
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

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });

    expect(decisionLog).toMatchObject({
      proposalId: proposal.id,
      actorId: (await getUserActor(user)).id,
      decision: "match_existing",
      bottleId: bottle.id,
      createdBottle: false,
    });
  });

  test("matches the requested exact Bottle without choosing the group representative", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const sourceBottle = await fixtures.Bottle({ name: "Generic Match" });
    const representative = await fixtures.BottleGroupMember({
      groupId: sourceBottle.groupId!,
      edition: "Representative",
    });
    await db
      .update(bottleGroups)
      .set({ representativeBottleId: representative.id })
      .where(eq(bottleGroups.id, sourceBottle.groupId!));
    const price = await fixtures.StorePrice({
      name: "Generic Group Listing",
      bottleId: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: sourceBottle.id,
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
      })
      .returning();

    const queue = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    const queueItem = queue.results.find((item) => item.id === proposal.id);
    expect(queueItem?.suggestedBottle).toMatchObject({
      id: sourceBottle.id,
    });

    await routerClient.prices.matchQueue.resolve(
      {
        proposal: proposal.id,
        action: "match",
        bottle: sourceBottle.id,
      },
      { context: { user } },
    );

    const [updatedPrice, updatedProposal, updatedAttempt, alias, decisionLog] =
      await Promise.all([
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, price.id),
        }),
        db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        }),
        db.query.storePriceMatchAttempts.findFirst({
          where: eq(storePriceMatchAttempts.id, attempt.id),
        }),
        db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, "Generic Group Listing"),
        }),
        db.query.incomingBottleDecisionLogs.findFirst({
          where: and(
            eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
            eq(incomingBottleDecisionLogs.sourceId, price.id),
          ),
        }),
      ]);

    expect(updatedPrice).toMatchObject({
      bottleId: sourceBottle.id,
    });
    expect(alias).toBeUndefined();
    expect(updatedProposal).toMatchObject({
      currentBottleId: sourceBottle.id,
      suggestedBottleId: sourceBottle.id,
    });
    expect(updatedAttempt).toMatchObject({
      currentBottleId: sourceBottle.id,
      suggestedBottleId: sourceBottle.id,
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      bottleId: sourceBottle.id,
    });
    expect(decisionLog?.bottleId).toBe(sourceBottle.id);
    expect(decisionLog?.bottleId).not.toBe(representative.id);
  });

  test("accepts an explicit active Bottle instead of the suggested Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const suggestedBottle = await fixtures.Bottle({
      name: "Suggested Generic",
    });
    const otherBottle = await fixtures.Bottle({ name: "Other Generic" });
    const price = await fixtures.StorePrice({ name: "Stale Generic Listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "global_alias",
        suggestedBottleId: suggestedBottle.id,
      })
      .returning();

    await routerClient.prices.matchQueue.resolve(
      {
        proposal: proposal.id,
        action: "match",
        bottle: otherBottle.id,
      },
      { context: { user } },
    );

    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).resolves.toMatchObject({
      bottleId: otherBottle.id,
    });
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, price.name),
      }),
    ).resolves.toBeUndefined();
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
        aliasScope: "global_alias",
        proposedBottle: completeProposedBottle({
          name: "Single Cask",
          brand: { id: brand.id, name: brand.name },
        }),
      })
      .returning();
    const priorReviewer = await fixtures.User({ mod: true });
    const priorBottle = await fixtures.Bottle({
      name: "Prior Attempt Bottle",
    });
    const [olderAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        finalStatus: "ignored",
        currentBottleId: priorBottle.id,
        suggestedBottleId: priorBottle.id,
        reviewedById: priorReviewer.id,
        reviewedAt: new Date("2026-01-01T00:00:00.000Z"),
      })
      .returning();
    const [latestAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "create_new",
        initialStatus: "pending_review",
      })
      .returning();
    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        independentBottle: {
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
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, result.id),
    });
    const observation = await db.query.bottleObservations.findFirst({
      where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });
    const [unchangedOlderAttempt, updatedLatestAttempt] = await Promise.all([
      db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, olderAttempt.id),
      }),
      db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, latestAttempt.id),
      }),
    ]);
    const userActor = await getUserActor(user);

    expect(result.fullName).toBe("Queue Brand Single Cask");
    expect(createdBottle?.groupId).not.toBeNull();
    expect(decisionLog).toMatchObject({
      actorId: userActor.id,
      decision: "create_bottle",
      bottleId: result.id,
      createdBottle: true,
      createdRelease: false,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: result.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: result.id,
      suggestedBottleId: result.id,
      reviewedById: user.id,
    });
    expect(updatedLatestAttempt).toMatchObject({
      finalStatus: "approved",
      currentBottleId: result.id,
      suggestedBottleId: result.id,
      reviewedById: user.id,
    });
    expect(unchangedOlderAttempt).toEqual(olderAttempt);
    expect(listingAlias).toMatchObject({
      bottleId: result.id,
      assignedByActorId: userActor.id,
    });
    expect(observation).toMatchObject({
      bottleId: result.id,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "VerifyBottleCreation",
      {
        bottleId: result.id,
        creationSource: "price_match_review",
      },
      { delay: 5000 },
    );
  });

  test("creates one Bottle with release-owned fields", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Creation Brand" });
    const site = await fixtures.ExternalSiteOrExisting({ type: "astorwines" });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Creation Candidate",
      bottleId: null,
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        proposedBottle: completeProposedBottle({
          name: "Private Selection",
          brand: { id: brand.id, name: brand.name },
          edition: "Batch 7",
          releaseYear: 2024,
        }),
      })
      .returning();

    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        independentBottle: {
          name: "Private Selection",
          brand: brand.id,
          edition: "Batch 7",
          releaseYear: 2024,
        },
      },
      { context: { user } },
    );

    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, result.id),
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(createdBottle).toMatchObject({
      edition: "Batch 7",
      releaseYear: 2024,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: result.id,
      suggestedBottleId: result.id,
      reviewedById: user.id,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: result.id,
    });
  });

  test("preserves the first incoming decision while assigning a new Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Decision History Brand" });
    const previousBottle = await fixtures.Bottle({
      name: "Previous Decision",
      brandId: brand.id,
    });
    const price = await fixtures.StorePrice({
      name: "Decision History Listing",
      bottleId: previousBottle.id,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        aliasScope: "global_alias",
        currentBottleId: previousBottle.id,
        proposedBottle: completeProposedBottle({
          name: "Replacement Decision",
          brand: { id: brand.id, name: brand.name },
        }),
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal.id,
        proposalType: "create_new",
        initialStatus: "pending_review",
        currentBottleId: previousBottle.id,
      })
      .returning();
    const actor = await getUserActor(user);
    const [priorDecision] = await db
      .insert(incomingBottleDecisionLogs)
      .values({
        sourceKind: "store_price",
        sourceId: price.id,
        proposalId: proposal.id,
        externalSiteId: price.externalSiteId,
        name: price.name,
        decision: "match_existing",
        actorId: actor.id,
        bottleId: previousBottle.id,
        createdBottle: false,
        createdRelease: false,
        rationale: "Retained first decision",
      })
      .returning();

    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        independentBottle: {
          name: "Replacement Decision",
          brand: brand.id,
        },
      },
      { context: { user } },
    );

    const [
      updatedPrice,
      updatedProposal,
      updatedAttempt,
      alias,
      observation,
      decisionLogs,
    ] = await Promise.all([
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt.id),
      }),
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, price.name),
      }),
      db.query.bottleObservations.findFirst({
        where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
      }),
      db
        .select()
        .from(incomingBottleDecisionLogs)
        .where(
          and(
            eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
            eq(incomingBottleDecisionLogs.sourceId, price.id),
          ),
        ),
    ]);
    const expectedPriceIdentity = {
      bottleId: result.id,
    };
    const expectedNewRuntimeIdentity = {
      bottleId: result.id,
    };

    expect(updatedPrice).toMatchObject(expectedPriceIdentity);
    expect(updatedProposal).toMatchObject({
      currentBottleId: result.id,
      suggestedBottleId: result.id,
    });
    expect(alias).toMatchObject(expectedNewRuntimeIdentity);
    expect(observation).toMatchObject(expectedNewRuntimeIdentity);
    expect(decisionLogs).toEqual([priorDecision]);
  });

  test("creates an independent Bottle from a complete Bottle input", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const groupBrand = await fixtures.Entity({ name: "Group Brand" });
    const groupDistiller = await fixtures.Entity({ name: "Group Distiller" });
    const groupBottler = await fixtures.Entity({ name: "Group Bottler" });
    const groupSeries = await fixtures.BottleSeries({
      brandId: groupBrand.id,
    });
    const durableBrand = await fixtures.Entity({ name: "Durable Brand" });
    const durableDistiller = await fixtures.Entity({
      name: "Durable Distiller",
    });
    const durableBottler = await fixtures.Entity({ name: "Durable Bottler" });
    const durableSeries = await fixtures.BottleSeries({
      brandId: durableBrand.id,
    });
    const sourceBottle = await fixtures.Bottle({
      name: "Trusted Expression",
      statedAge: 12,
      seriesId: groupSeries.id,
      category: "single_malt",
      brandId: groupBrand.id,
      bottlerId: groupBottler.id,
      flavorProfile: "peated",
      distillerIds: [groupDistiller.id],
    });
    await db
      .update(bottles)
      .set({
        statedAge: 15,
        seriesId: durableSeries.id,
        category: "bourbon",
        brandId: durableBrand.id,
        bottlerId: durableBottler.id,
        flavorProfile: "light_delicate",
      })
      .where(eq(bottles.id, sourceBottle.id));
    await db
      .delete(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, sourceBottle.id));
    await db.insert(bottlesToDistillers).values({
      bottleId: sourceBottle.id,
      distillerId: durableDistiller.id,
    });
    const [sourceBefore, sourceGroupBefore] = await Promise.all([
      db.query.bottles.findFirst({ where: eq(bottles.id, sourceBottle.id) }),
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, sourceBottle.groupId!),
      }),
    ]);
    const price = await fixtures.StorePrice({
      name: "Trusted Expression Batch 4",
      bottleId: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        proposedBottle: completeProposedBottle({
          name: "Trusted Expression",
          brand: { id: durableBrand.id, name: durableBrand.name },
          series: { id: durableSeries.id, name: durableSeries.name },
          category: "bourbon",
          bottler: { id: durableBottler.id, name: durableBottler.name },
          distillers: [
            { id: durableDistiller.id, name: durableDistiller.name },
          ],
          edition: "Batch 4",
          statedAge: 14,
          abv: 55.2,
          releaseYear: 2025,
        }),
      })
      .returning();
    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        independentBottle: {
          name: "Trusted Expression",
          brand: durableBrand.id,
          series: durableSeries.id,
          category: "bourbon",
          bottler: durableBottler.id,
          distillers: [durableDistiller.id],
          flavorProfile: "light_delicate",
          edition: "Batch 4",
          statedAge: 14,
          abv: 55.2,
          releaseYear: 2025,
        },
      },
      { context: { user } },
    );

    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, result.id),
    });
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    if (!createdBottle?.groupId) {
      throw new Error("Expected an independently grouped Bottle.");
    }
    const [
      createdGroup,
      createdGroupMembers,
      createdDistillers,
      sourceAfter,
      sourceGroupAfter,
    ] = await Promise.all([
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, createdBottle.groupId),
      }),
      db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.groupId, createdBottle.groupId)),
      db
        .select({ distillerId: bottlesToDistillers.distillerId })
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, createdBottle.id)),
      db.query.bottles.findFirst({
        where: eq(bottles.id, sourceBottle.id),
      }),
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, sourceBottle.groupId!),
      }),
    ]);

    expect(createdBottle).toMatchObject({
      edition: "Batch 4",
      statedAge: 14,
      seriesId: durableSeries.id,
      category: "bourbon",
      brandId: durableBrand.id,
      bottlerId: durableBottler.id,
      flavorProfile: "light_delicate",
      abv: 55.2,
      releaseYear: 2025,
    });
    expect(createdBottle?.name).toContain("Trusted Expression");
    expect(createdBottle?.groupId).not.toBe(sourceBottle.groupId);
    expect(createdGroup).toMatchObject({
      name: "Trusted Expression",
      statedAge: null,
      seriesId: durableSeries.id,
      category: "bourbon",
      brandId: durableBrand.id,
      bottlerId: durableBottler.id,
      flavorProfile: "light_delicate",
    });
    expect(sourceGroupBefore).toMatchObject({
      name: "Trusted Expression",
      statedAge: 12,
      seriesId: groupSeries.id,
      category: "single_malt",
      brandId: groupBrand.id,
      bottlerId: groupBottler.id,
      flavorProfile: "peated",
    });
    expect(createdDistillers).toEqual([{ distillerId: durableDistiller.id }]);
    expect(createdGroupMembers).toEqual([{ id: result.id }]);
    expect(decisionLog).toMatchObject({
      decision: "create_bottle",
      bottleId: result.id,
      createdBottle: true,
      createdRelease: false,
    });
    expect(sourceAfter).toEqual(sourceBefore);
    expect(sourceGroupAfter).toEqual(sourceGroupBefore);
  });

  test("rejects mixed canonical and legacy create inputs without writes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Exclusive Input Brand" });
    const price = await fixtures.StorePrice({
      name: "Exclusive Input Listing",
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
    const [bottlesBefore, groupsBefore] = await Promise.all([
      db.select({ id: bottles.id }).from(bottles),
      db.select({ id: bottleGroups.id }).from(bottleGroups),
    ]);

    const error = await waitError(
      // SAFETY: This test calls the old positional form to verify runtime rejection.
      (routerClient.prices.matchQueue.createBottle as any)(
        {
          proposal: proposal.id,
          independentBottle: {
            name: "Canonical Candidate",
            brand: brand.id,
          },
          bottle: {
            name: "Legacy Candidate",
            brand: brand.id,
          },
        },
        { context: { user } },
      ),
    );

    const [updatedProposal, bottlesAfter, groupsAfter] = await Promise.all([
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db.select({ id: bottles.id }).from(bottles),
      db.select({ id: bottleGroups.id }).from(bottleGroups),
    ]);

    expect(error.message).toBe("Input validation failed");
    expect(updatedProposal).toMatchObject({ status: "pending_review" });
    expect(bottlesAfter).toEqual(bottlesBefore);
    expect(groupsAfter).toEqual(groupsBefore);
  });

  test("creates independently instead of inferring the proposal parent group", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Retry Brand" });
    const series = await fixtures.BottleSeries({ brandId: brand.id });
    const sourceBottle = await fixtures.Bottle({
      name: "Retry Expression",
      brandId: brand.id,
      seriesId: series.id,
    });
    const existing = await fixtures.BottleGroupMember({
      groupId: sourceBottle.groupId!,
      edition: "Batch 8",
      statedAge: 14,
      abv: 53,
    });
    const price = await fixtures.StorePrice({
      name: "Retry Expression Batch 9 Listing",
      bottleId: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        proposedBottle: completeProposedBottle({
          name: "Retry Expression",
          brand: { id: brand.id, name: brand.name },
          series: { id: series.id, name: series.name },
          edition: "Batch 9",
          statedAge: 15,
          abv: 54,
        }),
      })
      .returning();
    const [seriesBefore, bottlesBefore, groupsBefore] = await Promise.all([
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
      db.select({ id: bottles.id }).from(bottles),
      db.select({ id: bottleGroups.id }).from(bottleGroups),
    ]);
    vi.mocked(workerClient.pushUniqueJob).mockClear();

    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        independentBottle: {
          name: "Retry Expression",
          brand: brand.id,
          series: series.id,
          edition: "Batch 9",
          statedAge: 15,
          abv: 54,
        },
      },
      { context: { user } },
    );

    const [updatedPrice, decisionLog, seriesAfter, bottlesAfter, groupsAfter] =
      await Promise.all([
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, price.id),
        }),
        db.query.incomingBottleDecisionLogs.findFirst({
          where: and(
            eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
            eq(incomingBottleDecisionLogs.sourceId, price.id),
          ),
        }),
        db.query.bottleSeries.findFirst({
          where: eq(bottleSeries.id, series.id),
        }),
        db.select({ id: bottles.id }).from(bottles),
        db.select({ id: bottleGroups.id }).from(bottleGroups),
      ]);

    expect(result).toMatchObject({
      id: expect.any(Number),
    });
    expect(result.id).not.toBe(existing.id);
    expect(updatedPrice).toMatchObject({
      bottleId: result.id,
    });
    expect(decisionLog).toMatchObject({
      decision: "create_bottle",
      bottleId: result.id,
      createdBottle: true,
      createdRelease: false,
    });
    expect(seriesAfter?.numReleases).toBeGreaterThan(
      seriesBefore?.numReleases ?? 0,
    );
    expect(bottlesAfter).toHaveLength(bottlesBefore.length + 1);
    expect(groupsAfter).toHaveLength(groupsBefore.length + 1);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "VerifyBottleCreation",
      {
        bottleId: result.id,
        creationSource: "price_match_review",
      },
      { delay: 5000 },
    );
  });

  test("reuses an exact duplicate without inheriting its source group", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Cross Group Brand" });
    const sourceBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Cross Group Expression",
    });
    const existing = await fixtures.Bottle({
      brandId: brand.id,
      name: "Cross Group Expression",
      edition: "Batch 8",
    });
    const price = await fixtures.StorePrice({
      name: "Cross Group Duplicate Listing",
      bottleId: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        proposedBottle: completeProposedBottle({
          name: "Cross Group Expression",
          brand: { id: brand.id, name: brand.name },
          edition: "Batch 8",
        }),
      })
      .returning();

    const result = await routerClient.prices.matchQueue.createBottle(
      {
        proposal: proposal.id,
        independentBottle: {
          name: "Cross Group Expression",
          brand: brand.id,
          edition: "Batch 8",
        },
      },
      { context: { user } },
    );

    const [updatedPrice, updatedProposal, decisionLog] = await Promise.all([
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
      db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
          eq(incomingBottleDecisionLogs.sourceId, price.id),
        ),
      }),
    ]);

    expect(result).toMatchObject({
      id: existing.id,
    });
    expect(sourceBottle.groupId).not.toBe(existing.groupId);
    expect(updatedPrice).toMatchObject({
      bottleId: existing.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: existing.id,
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      bottleId: existing.id,
      createdBottle: false,
      createdRelease: false,
    });
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
          independentBottle: {
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

  test("rejects legacy release values outside the canonical Bottle contract without writes", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const sourceBottle = await fixtures.Bottle({ name: "Canonical Source" });
    const price = await fixtures.StorePrice({
      name: "Canonical Source Fractional Age",
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
    const [bottlesBefore, groupsBefore] = await Promise.all([
      db.select({ id: bottles.id }).from(bottles),
      db.select({ id: bottleGroups.id }).from(bottleGroups),
    ]);

    const error = await waitError(
      // SAFETY: This test calls the old positional form to verify runtime rejection.
      (routerClient.prices.matchQueue.createBottle as any)(
        {
          proposal: proposal.id,
          release: { edition: "Fractional", statedAge: 12.5 },
        },
        { context: { user } },
      ),
    );

    const [updatedProposal, updatedPrice, bottlesAfter, groupsAfter] =
      await Promise.all([
        db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        }),
        db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
        db.select({ id: bottles.id }).from(bottles),
        db.select({ id: bottleGroups.id }).from(bottleGroups),
      ]);

    expect(error).toMatchObject({ status: 400 });
    expect(updatedProposal).toMatchObject({ status: "pending_review" });
    expect(updatedPrice).toMatchObject({
      bottleId: null,
    });
    expect(bottlesAfter).toHaveLength(bottlesBefore.length);
    expect(groupsAfter).toHaveLength(groupsBefore.length);
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
        proposedBottle: completeProposedBottle({
          name: "Should Not Exist",
          brand: { id: brand.id, name: brand.name },
        }),
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: proposal.id,
          independentBottle: {
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
        proposedBottle: completeProposedBottle({
          name: "Already Reviewed",
          brand: { id: brand.id, name: brand.name },
        }),
      })
      .returning();
    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: proposal.id,
          independentBottle: {
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
        aliasScope: "global_alias",
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
      `[Error: Cannot reserve exact Bottle alias "Conflicting Alias": another_bottle.]`,
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
    const groupsBefore = await db
      .select({ id: bottleGroups.id })
      .from(bottleGroups);

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        aliasScope: "global_alias",
        proposedBottle: completeProposedBottle({
          name: "Fresh Release",
          brand: { id: brand.id, name: brand.name },
        }),
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.createBottle(
        {
          proposal: proposal.id,
          independentBottle: {
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
    const groupsAfter = await db
      .select({ id: bottleGroups.id })
      .from(bottleGroups);

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot reserve exact Bottle alias "Create Alias Collision": another_bottle.]`,
    );
    expect(createdBottle).toBeUndefined();
    expect(groupsAfter).toHaveLength(groupsBefore.length);
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

  test("bulk retry starts a background run for actionable search results", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const otherSite = await fixtures.ExternalSiteOrExisting({
      type: "totalwine",
    });
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
        externalSiteId: otherSite.id,
        name: "SMWS Retry Other Site",
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
      { query: "SMWS Retry", site: "smws" },
      { context: { user } },
    );
    const runItems = await db
      .select()
      .from(storePriceMatchRetryRunItems)
      .where(eq(storePriceMatchRetryRunItems.runId, result.id));

    expect(result).toMatchObject({
      id: expect.any(Number),
      matchedCount: 2,
      mode: "no_web",
      pendingCount: 2,
      processedCount: 0,
      progress: 0,
      query: "SMWS Retry",
      site: "smws",
      status: "pending",
    });
    expect(runItems).toHaveLength(2);
    expect(
      runItems.map((item) => item.proposalId).sort((a, b) => a - b),
    ).toEqual([firstProposal.id, secondProposal.id]);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "ProcessStorePriceMatchRetryRun",
      {
        runId: result.id,
      },
      {
        delay: 0,
        removeOnComplete: true,
      },
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.anything(),
    );
  });

  test("bulk retry rejects starting a second active run", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        createdById: user.id,
        matchedCount: 1,
        status: "running",
      })
      .returning();

    const err = await waitError(
      routerClient.prices.matchQueue.retryAll(
        { query: "SMWS Retry" },
        { context: { user } },
      ),
    );

    expect(err).toMatchObject({
      message: `Retry run ${run!.id} is already running.`,
    });
  });

  test("can read and request cancellation for a retry run", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        createdById: user.id,
        matchedCount: 3,
        processedCount: 1,
        status: "running",
      })
      .returning();

    const details = await routerClient.prices.matchQueue.retryRunDetails(
      { run: run!.id },
      { context: { user } },
    );
    const active = await routerClient.prices.matchQueue.activeRetryRun(
      undefined,
      { context: { user } },
    );
    const canceled = await routerClient.prices.matchQueue.cancelRetryRun(
      { run: run!.id },
      { context: { user } },
    );

    expect(details).toMatchObject({
      id: run!.id,
      matchedCount: 3,
      pendingCount: 2,
      progress: 33,
      status: "running",
    });
    expect(active.run).toMatchObject({
      id: run!.id,
      status: "running",
    });
    expect(canceled).toMatchObject({
      cancelRequestedAt: expect.any(String),
      id: run!.id,
      status: "running",
    });
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
