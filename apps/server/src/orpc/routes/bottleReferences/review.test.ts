import { db } from "@peated/server/db";
import {
  bottleReferences,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import { findBottleReferenceAssignment } from "@peated/server/lib/bottleFinder";
import { getBottleReferenceStateToken } from "@peated/server/lib/bottleReferenceReview";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

beforeEach(() => vi.resetAllMocks());

describe("POST /bottle-references/:reference/review", () => {
  test("verifies a reference and keeps exact matching active", async ({
    fixtures,
  }) => {
    const reference = await fixtures.BottleReference({
      name: "Verified Exact Reference",
    });
    const moderator = await fixtures.User({ mod: true });

    const result = await routerClient.bottleReferences.review(
      {
        reference: reference.id,
        action: "verify",
        stateToken: getBottleReferenceStateToken(reference),
      },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({ id: reference.id, ignored: false });
    await expect(
      findBottleReferenceAssignment(reference.name),
    ).resolves.toMatchObject({
      bottleId: reference.bottleId,
    });
  });

  test("uses the returned state token for a later review", async ({
    fixtures,
  }) => {
    const reference = await fixtures.BottleReference({
      name: "Review Again Reference",
    });
    const moderator = await fixtures.User({ mod: true });
    const verified = await routerClient.bottleReferences.review(
      {
        reference: reference.id,
        action: "verify",
        stateToken: getBottleReferenceStateToken(reference),
      },
      { context: { user: moderator } },
    );

    await expect(
      routerClient.bottleReferences.review(
        {
          reference: reference.id,
          action: "quarantine",
          stateToken: verified.stateToken,
        },
        { context: { user: moderator } },
      ),
    ).resolves.toMatchObject({ ignored: true });
  });

  test("quarantines future matching without rewriting existing consumers", async ({
    fixtures,
  }) => {
    const reference = await fixtures.BottleReference({
      name: "Risky Generic Name",
    });
    const price = await fixtures.StorePrice({
      name: reference.name,
      bottleId: reference.bottleId,
    });
    const review = await fixtures.ExternalReview({
      name: reference.name,
      bottleId: reference.bottleId,
    });
    const moderator = await fixtures.User({ mod: true });

    await routerClient.bottleReferences.review(
      {
        reference: reference.id,
        action: "quarantine",
        stateToken: getBottleReferenceStateToken(reference),
      },
      { context: { user: moderator } },
    );

    await expect(
      findBottleReferenceAssignment(reference.name),
    ).resolves.toBeNull();
    await expect(
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
    ).resolves.toMatchObject({ bottleId: reference.bottleId });
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).resolves.toMatchObject({ bottleId: reference.bottleId });
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.id, reference.id),
      }),
    ).resolves.toMatchObject({ ignored: true, embedding: null });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleReference", {
      name: reference.name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: reference.bottleId },
    );
  });

  test("rejects a stale state token", async ({ fixtures }) => {
    const reference = await fixtures.BottleReference();
    const moderator = await fixtures.User({ mod: true });
    await db
      .update(bottleReferences)
      .set({ assignmentSource: "human_approved" })
      .where(eq(bottleReferences.id, reference.id));

    await expect(
      waitError(
        routerClient.bottleReferences.review(
          {
            reference: reference.id,
            action: "verify",
            stateToken: getBottleReferenceStateToken(reference),
          },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(
      `[Error: Bottle reference changed. Reload it and try again.]`,
    );
  });
});
