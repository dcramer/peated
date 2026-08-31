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

describe("PUT /bottle-references", () => {
  test("creates a direct Bottle reference with moderator provenance", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);

    await expect(
      routerClient.bottleReferences.upsert(
        { bottle: bottle.id, name: "New Direct Reference" },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, "New Direct Reference"),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
      assignedByActorId: actor.id,
    });
  });

  test("propagates the same Bottle id to unresolved matching consumers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const name = "Direct Propagation Reference";
    const price = await fixtures.StorePrice({ name, bottleId: null });
    const review = await fixtures.ExternalReview({ name, bottleId: null });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleReferences.upsert(
      { bottle: bottle.id, name },
      { context: { user } },
    );

    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
  });

  test("assigns an existing unresolved reference and reindexes it", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const actor = await getUserActor(await fixtures.User());
    const [reference] = await db
      .insert(bottleReferences)
      .values({
        name: "Existing Unresolved Reference",
        bottleId: null,
        assignedByActorId: actor.id,
      })
      .returning();
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleReferences.upsert(
      { bottle: bottle.id, name: reference!.name },
      { context: { user } },
    );

    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference!.name),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleReference", {
      name: reference!.name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("does not overwrite consumers assigned to another Bottle", async ({
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const existing = await fixtures.Bottle();
    const name = "Already Assigned Consumer";
    const price = await fixtures.StorePrice({
      name,
      bottleId: existing.id,
    });
    const review = await fixtures.ExternalReview({
      name,
      bottleId: existing.id,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleReferences.upsert(
      { bottle: selected.id, name },
      { context: { user } },
    );

    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).resolves.toMatchObject({ bottleId: existing.id });
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).resolves.toMatchObject({ bottleId: existing.id });
  });

  test("fills a missing Bottle image from a matching price", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    await fixtures.StorePrice({
      name: "Direct Image Reference",
      bottleId: null,
      imageUrl: "https://example.com/direct-image.jpg",
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleReferences.upsert(
      { bottle: bottle.id, name: "Direct Image Reference" },
      { context: { user } },
    );

    await expect(
      db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      }),
    ).resolves.toMatchObject({
      imageUrl: "https://example.com/direct-image.jpg",
    });
  });

  test("rejects missing, inactive, and conflicting Bottles", async ({
    fixtures,
  }) => {
    const existing = await fixtures.Bottle();
    const inactive = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.BottleReference({
      bottleId: existing.id,
      name: "Conflicting Direct Reference",
    });
    await db.insert(bottleTombstones).values({
      bottleId: inactive.id,
      newBottleId: replacement.id,
    });
    const user = await fixtures.User({ mod: true });

    await expect(
      waitError(
        // SAFETY: This test sends the retired groupId field to the runtime validator.
        routerClient.bottleReferences.upsert(
          { bottle: 2_147_483_647, name: "Missing Bottle Reference" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 404, message: "Bottle not found." });
    await expect(
      waitError(
        routerClient.bottleReferences.upsert(
          { bottle: inactive.id, name: "Inactive Bottle Reference" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 409 });
    await expect(
      waitError(
        routerClient.bottleReferences.upsert(
          { bottle: replacement.id, name: "conflicting direct reference" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({
      status: 409,
      message:
        'Cannot reserve exact Bottle reference "Conflicting Direct Reference": another_bottle.',
    });
  });

  test("rejects BottleGroup targeting and requires moderator access", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    const user = await fixtures.User({ mod: false });

    await expect(
      waitError(
        routerClient.bottleReferences.upsert(
          // SAFETY: This test sends the retired groupId field to the runtime validator.
          {
            bottle: bottle.id,
            groupId: bottle.groupId,
            name: "Group Target Reference",
          } as never,
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchObject({ status: 400 });

    await expect(
      waitError(
        routerClient.bottleReferences.upsert(
          { bottle: bottle.id, name: "Unauthorized Reference" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("keeps the committed assignment when indexing is unavailable", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      routerClient.bottleReferences.upsert(
        { bottle: bottle.id, name: "Queue Failure Reference" },
        { context: { user } },
      ),
    ).resolves.toEqual({});
    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, "Queue Failure Reference"),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
  });
});
