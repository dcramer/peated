import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottleTombstones,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PATCH /bottle-references/:reference", () => {
  test("reassigns the reference and exact consumers using the old identity", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Wrong Bottle" });
    const target = await fixtures.Bottle({ name: "Right Bottle" });
    const unrelated = await fixtures.Bottle({ name: "Other Bottle" });
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const name = "Verified Reference";
    const reference = await fixtures.BottleReference({
      bottleId: source.id,
      name,
      assignmentSource: "legacy",
    });
    const sourcePrice = await fixtures.StorePrice({
      bottleId: source.id,
      name,
    });
    const unresolvedPrice = await fixtures.StorePrice({
      bottleId: null,
      name: name.toLowerCase(),
    });
    const similarPrice = await fixtures.StorePrice({
      bottleId: source.id,
      name: `${name} 2025`,
    });
    const unrelatedPrice = await fixtures.StorePrice({
      bottleId: unrelated.id,
      name,
    });
    const sourceReview = await fixtures.ExternalReview({
      bottleId: source.id,
      name,
    });
    const unresolvedReview = await fixtures.ExternalReview({
      bottleId: null,
      name: name.toUpperCase(),
    });
    const unrelatedReview = await fixtures.ExternalReview({
      bottleId: unrelated.id,
      name,
    });

    const result = await routerClient.bottleReferences.update(
      {
        reference: reference.id,
        expectedBottle: source.id,
        expectedIgnored: false,
        bottle: target.id,
        ignored: false,
      },
      { context: { user } },
    );

    expect(result).toEqual({
      id: reference.id,
      name,
      createdAt: reference.createdAt.toISOString(),
      bottleId: target.id,
      ignored: false,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
    await expect(
      routerClient.bottleReferences.details(
        { reference: reference.id },
        { context: { user } },
      ),
    ).resolves.toEqual(result);
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.id, reference.id),
      }),
    ).resolves.toMatchObject({
      bottleId: target.id,
      ignored: false,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
      embedding: null,
      reviewedAt: null,
      reviewedByActorId: null,
    });

    for (const consumer of [sourcePrice, unresolvedPrice]) {
      await expect(
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, consumer.id),
        }),
      ).resolves.toMatchObject({ bottleId: target.id });
    }
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, unrelatedPrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: unrelated.id });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, similarPrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: source.id });

    for (const consumer of [sourceReview, unresolvedReview]) {
      await expect(
        db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, consumer.id),
        }),
      ).resolves.toMatchObject({ bottleId: target.id });
    }
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, unrelatedReview.id),
      }),
    ).resolves.toMatchObject({ bottleId: unrelated.id });

    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleReference", {
      name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: source.id },
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: target.id },
    );
  });

  test("unassigns the reference and exact consumers using the old identity", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Wrong Bottle" });
    const unrelated = await fixtures.Bottle({ name: "Other Bottle" });
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const name = "Ambiguous Reference";
    const reference = await fixtures.BottleReference({
      bottleId: source.id,
      name,
    });
    const sourcePrice = await fixtures.StorePrice({
      bottleId: source.id,
      name,
    });
    const unrelatedPrice = await fixtures.StorePrice({
      bottleId: unrelated.id,
      name,
    });
    const sourceReview = await fixtures.ExternalReview({
      bottleId: source.id,
      name,
    });
    const unrelatedReview = await fixtures.ExternalReview({
      bottleId: unrelated.id,
      name,
    });

    const result = await routerClient.bottleReferences.update(
      {
        reference: reference.id,
        expectedBottle: source.id,
        expectedIgnored: false,
        bottle: null,
        ignored: true,
      },
      { context: { user } },
    );

    expect(result).toEqual({
      id: reference.id,
      name,
      createdAt: reference.createdAt.toISOString(),
      bottleId: null,
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
    await expect(
      routerClient.bottleReferences.details(
        { reference: reference.id },
        { context: { user } },
      ),
    ).resolves.toEqual(result);
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.id, reference.id),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, sourcePrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: null });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, unrelatedPrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: unrelated.id });
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, sourceReview.id),
      }),
    ).resolves.toMatchObject({ bottleId: null });
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, unrelatedReview.id),
      }),
    ).resolves.toMatchObject({ bottleId: unrelated.id });
  });

  test("rejects a stale expected Bottle without changing data", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle();
    const target = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    const reference = await fixtures.BottleReference({
      bottleId: source.id,
      name: "Stale Reference",
    });
    const price = await fixtures.StorePrice({
      bottleId: source.id,
      name: reference.name,
    });

    const error = await waitError(
      routerClient.bottleReferences.update(
        {
          reference: reference.id,
          expectedBottle: null,
          expectedIgnored: false,
          bottle: target.id,
          ignored: false,
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
    await expect(
      waitError(
        routerClient.bottleReferences.update(
          {
            reference: reference.id,
            expectedBottle: source.id,
            expectedIgnored: true,
            bottle: null,
            ignored: true,
          },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 409 });
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.id, reference.id),
      }),
    ).resolves.toMatchObject({ bottleId: source.id });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).resolves.toMatchObject({ bottleId: source.id });
  });

  test("prevents changing the current full-name reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Canonical Bottle" });
    const user = await fixtures.User({ mod: true });
    const reference = await db.query.bottleReferences.findFirst({
      where: eq(bottleReferences.name, bottle.fullName),
    });
    expect(reference).toBeDefined();

    const error = await waitError(
      routerClient.bottleReferences.update(
        {
          reference: reference!.id,
          expectedBottle: bottle.id,
          expectedIgnored: false,
          bottle: null,
          ignored: false,
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      status: 400,
      message:
        "A Bottle's current full name cannot be reassigned or unassigned.",
    });
  });

  test("rejects missing references and invalid target Bottles", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle();
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    const reference = await fixtures.BottleReference({
      bottleId: source.id,
      name: "Target Validation Reference",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    await expect(
      waitError(
        routerClient.bottleReferences.update(
          {
            reference: 2_147_483_647,
            expectedBottle: null,
            expectedIgnored: false,
            bottle: null,
            ignored: false,
          },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 404 });
    await expect(
      waitError(
        routerClient.bottleReferences.update(
          {
            reference: reference.id,
            expectedBottle: source.id,
            expectedIgnored: false,
            bottle: 2_147_483_647,
            ignored: false,
          },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 404 });
    await expect(
      waitError(
        routerClient.bottleReferences.update(
          {
            reference: reference.id,
            expectedBottle: source.id,
            expectedIgnored: false,
            bottle: retired.id,
            ignored: false,
          },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 409 });
    await expect(
      waitError(
        routerClient.bottleReferences.update(
          {
            reference: reference.id,
            expectedBottle: source.id,
            expectedIgnored: false,
            bottle: replacement.id,
            ignored: true,
          },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      waitError(
        routerClient.bottleReferences.details(
          { reference: 2_147_483_647 },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 404 });
  });

  test("requires moderator access", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Protected Reference",
    });
    const user = await fixtures.User({ mod: false });

    await expect(
      waitError(
        routerClient.bottleReferences.update(
          {
            reference: reference.id,
            expectedBottle: bottle.id,
            expectedIgnored: false,
            bottle: null,
            ignored: false,
          },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    await expect(
      waitError(
        routerClient.bottleReferences.details(
          { reference: reference.id },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
