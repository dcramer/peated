import { db } from "@peated/server/db";
import {
  auctionLots,
  bottleChecks,
  externalReviews,
  storePriceMatchProposals,
} from "@peated/server/db/schema";
import { upsertAuctionObservation } from "@peated/server/lib/auctions";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test, type TestContext } from "vitest";

const SAMPLE_REASON =
  "The scope pre-check found a sample, not one whisky Bottle (confidence 0.83).";

async function saveCheck(
  sourceKind: "store_price" | "auction_lot" | "review",
  sourceId: number,
  output: NonNullable<(typeof bottleChecks.$inferInsert)["output"]>,
  createdAt: Date,
) {
  const [check] = await db
    .insert(bottleChecks)
    .values({
      intent: "resolve_reference",
      sourceKind,
      sourceId: String(sourceId),
      subjectKey: `${sourceKind}:${sourceId}:${createdAt.getTime()}`,
      schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
      inputSnapshot: {},
      output,
      createdAt,
      completedAt: createdAt,
    })
    .returning();
  return check!;
}

const ignoredOutput = (reason: string) => ({
  status: "ignored",
  reason,
  artifacts: {},
});
const noMatchOutput = {
  status: "classified",
  decision: { action: "no_match", rationale: "No candidate fits." },
  artifacts: {},
};

async function listing(
  fixtures: TestContext["fixtures"],
  name: string,
  values: Partial<typeof storePriceMatchProposals.$inferInsert> = {},
  hidden = false,
) {
  const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
  const price = await fixtures.StorePrice({
    bottleId: null,
    externalSiteId: site.id,
    name,
    url: `https://example.com/${encodeURIComponent(name)}`,
    hidden,
  });
  const [proposal] = await db
    .insert(storePriceMatchProposals)
    .values({
      priceId: price.id,
      proposalType: "no_match",
      status: "ignored",
      ...values,
    })
    .returning();
  return { price, proposal: proposal! };
}

async function auctionLot(fixtures: TestContext["fixtures"], name: string) {
  const site = await fixtures.ExternalSite();
  const { lot } = await upsertAuctionObservation(site.id, {
    auction: {
      sourceKey: name,
      name: "Auction",
      url: `https://example.com/auction/${encodeURIComponent(name)}`,
    },
    lot: {
      sourceKey: name,
      name,
      url: `https://example.com/lot/${encodeURIComponent(name)}`,
      state: "closed" as const,
    },
    observedAt: new Date().toISOString(),
  });
  return lot;
}

describe("GET /admin/moderation/ignored", () => {
  test("requires a moderator", async ({ fixtures }) => {
    const user = await fixtures.User();
    const err = await waitError(
      routerClient.admin.moderation.listIgnored({}, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists ignored listings, auction lots, and reviews with their reasons", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true, username: "ignore-mod" });

    const autoListing = await listing(fixtures, "Ardbeg Sample 3cl");
    await saveCheck(
      "store_price",
      autoListing.price.id,
      ignoredOutput(SAMPLE_REASON),
      new Date("2026-11-01T00:00:00Z"),
    );

    // A moderator ignored this listing after the classifier matched nothing,
    // so the old run does not explain it.
    const modListing = await listing(fixtures, "Glencairn Glass", {
      reviewedById: mod.id,
      reviewedAt: new Date("2026-11-02T00:00:00Z"),
    });
    await saveCheck(
      "store_price",
      modListing.price.id,
      noMatchOutput,
      new Date("2026-10-30T00:00:00Z"),
    );

    const lot = await auctionLot(fixtures, "Distillery Hand-Fill 20cl");
    const lotCheck = await saveCheck(
      "auction_lot",
      lot.id,
      ignoredOutput("A distillery hand-fill, not one whisky Bottle."),
      new Date("2026-11-03T00:00:00Z"),
    );
    await db
      .update(auctionLots)
      .set({ matchCheckId: lotCheck.id, matchStatus: "ignored" })
      .where(eq(auctionLots.id, lot.id));

    const review = await fixtures.ExternalReview({
      name: "Whisky Liqueur Review",
      bottleId: null,
    });
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: new Date("2026-11-04T00:00:00Z") })
      .where(eq(externalReviews.id, review.id));
    await saveCheck(
      "review",
      review.id,
      ignoredOutput("A whisky liqueur, not one whisky Bottle."),
      new Date("2026-11-04T00:00:00Z"),
    );

    const { results, rel } = await routerClient.admin.moderation.listIgnored(
      {},
      { context: { user: mod } },
    );

    expect(results).toMatchObject([
      {
        key: `external_review:${review.id}`,
        source: { kind: "external_review", reviewId: review.id },
        title: "Whisky Liqueur Review",
        reason: "A whisky liqueur, not one whisky Bottle.",
        ignoredBy: null,
        ignoredAt: "2026-11-04T00:00:00.000Z",
      },
      {
        key: `auction_lot:${lot.id}`,
        source: { kind: "auction_lot", lotId: lot.id },
        reason: "A distillery hand-fill, not one whisky Bottle.",
        ignoredBy: null,
      },
      {
        key: `listing:${modListing.proposal.id}`,
        reason: null,
        ignoredBy: "ignore-mod",
        ignoredAt: "2026-11-02T00:00:00.000Z",
      },
      {
        key: `listing:${autoListing.proposal.id}`,
        source: {
          kind: "listing",
          proposalId: autoListing.proposal.id,
          priceId: autoListing.price.id,
        },
        title: "Ardbeg Sample 3cl",
        reason: SAMPLE_REASON,
        ignoredBy: null,
      },
    ]);
    expect(rel).toEqual({ nextCursor: null, prevCursor: null });

    const automatic = await routerClient.admin.moderation.listIgnored(
      { ignoredBy: "automatic", kind: "listing" },
      { context: { user: mod } },
    );
    expect(automatic.results.map(({ key }) => key)).toEqual([
      `listing:${autoListing.proposal.id}`,
    ]);

    const search = await routerClient.admin.moderation.listIgnored(
      { query: "pre-check" },
      { context: { user: mod } },
    );
    expect(search.results.map(({ key }) => key)).toEqual([
      `listing:${autoListing.proposal.id}`,
    ]);
  });

  test("leaves out sources that are not ignored now", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });

    await listing(fixtures, "Pending Listing", { status: "pending_review" });
    const hidden = await listing(fixtures, "Hidden Sample", {}, true);
    await saveCheck(
      "store_price",
      hidden.price.id,
      ignoredOutput(SAMPLE_REASON),
      new Date("2026-11-01T00:00:00Z"),
    );

    const lot = await auctionLot(fixtures, "Lot In Review");
    await db
      .update(auctionLots)
      .set({ matchStatus: "review" })
      .where(eq(auctionLots.id, lot.id));

    // An earlier run ignored this review, but the latest one did not.
    const review = await fixtures.ExternalReview({
      name: "Rechecked Review",
      bottleId: null,
    });
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: new Date("2026-11-04T00:00:00Z") })
      .where(eq(externalReviews.id, review.id));
    await saveCheck(
      "review",
      review.id,
      ignoredOutput(SAMPLE_REASON),
      new Date("2026-11-01T00:00:00Z"),
    );
    await saveCheck(
      "review",
      review.id,
      noMatchOutput,
      new Date("2026-11-04T00:00:00Z"),
    );

    const { results } = await routerClient.admin.moderation.listIgnored(
      {},
      { context: { user: mod } },
    );
    expect(results).toEqual([]);
  });
});
