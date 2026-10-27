import { createDecidedBottleClassification } from "@peated/bottle-classifier/contract";
import { db } from "@peated/server/db";
import { auctionLots, bottleTombstones } from "@peated/server/db/schema";
import { auctionLotCheckKey } from "@peated/server/lib/auctionMatchEvidence";
import { upsertAuctionObservation } from "@peated/server/lib/auctions";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { getBottleCandidateById } from "@peated/server/lib/bottleReferenceCandidates";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /auction-lots/{lot}", () => {
  test("shows the active Bottles a no-match check considered, in saved order", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    const merged = await fixtures.Bottle();
    await db
      .insert(bottleTombstones)
      .values({ bottleId: merged.id, newBottleId: first.id });
    const site = await fixtures.ExternalSite();
    const { lot } = await upsertAuctionObservation(site.id, {
      auction: {
        sourceKey: "1",
        name: "Auction",
        url: "https://example.com/auction",
      },
      lot: {
        sourceKey: "1",
        name: "Example 10 Year Old Circa 1990s",
        url: "https://example.com/lot",
        imageUrl: "https://example.com/lot.jpg",
        state: "closed",
      },
      observedAt: new Date().toISOString(),
    });
    const result = createDecidedBottleClassification({
      decision: {
        action: "no_match",
        matchedBottleId: null,
        candidateBottleIds: [second.id, merged.id, first.id],
        rationale: "The title does not show which label this is.",
        identityScope: "product",
        referenceScope: "none",
        observation: null,
        proposedBottle: null,
        confidenceBasis: {
          webEvidence: "weak",
          unresolvedRisks: [
            {
              category: "identity_ambiguity",
              note: "Two labels share this age.",
            },
          ],
        },
      },
      artifacts: {
        candidates: [
          (await getBottleCandidateById(second.id))!,
          (await getBottleCandidateById(first.id))!,
        ],
      },
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

    const details = await routerClient.auctions.details(
      { lot: lot.id },
      { context: { user: moderator } },
    );

    expect(details.suggestedBottle).toBeNull();
    expect(details.sourceImageUrl).toBe("https://example.com/lot.jpg");
    expect(details.candidateBottles.map(({ id }) => id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});
