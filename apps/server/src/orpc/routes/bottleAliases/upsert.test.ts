import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  reviews,
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

describe("PUT /bottle-aliases", () => {
  test("creates a direct Bottle alias with moderator provenance", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);

    await expect(
      routerClient.bottleAliases.upsert(
        { bottle: bottle.id, name: "New Direct Alias" },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "New Direct Alias"),
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
    const name = "Direct Propagation Alias";
    const price = await fixtures.StorePrice({ name, bottleId: null });
    const review = await fixtures.Review({ name, bottleId: null });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: bottle.id, name },
      { context: { user } },
    );

    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    await expect(
      db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
  });

  test("assigns an existing unresolved alias and reindexes it", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const actor = await getUserActor(await fixtures.User());
    const [alias] = await db
      .insert(bottleAliases)
      .values({
        name: "Existing Unresolved Alias",
        bottleId: null,
        assignedByActorId: actor.id,
      })
      .returning();
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: bottle.id, name: alias!.name },
      { context: { user } },
    );

    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias!.name),
      }),
    ).resolves.toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "human_approved",
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias!.name,
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
    const review = await fixtures.Review({
      name,
      bottleId: existing.id,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: selected.id, name },
      { context: { user } },
    );

    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).resolves.toMatchObject({ bottleId: existing.id });
    await expect(
      db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).resolves.toMatchObject({ bottleId: existing.id });
  });

  test("fills a missing Bottle image from a matching price", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    await fixtures.StorePrice({
      name: "Direct Image Alias",
      bottleId: null,
      imageUrl: "https://example.com/direct-image.jpg",
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      { bottle: bottle.id, name: "Direct Image Alias" },
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
    await fixtures.BottleAlias({
      bottleId: existing.id,
      name: "Conflicting Direct Alias",
    });
    await db.insert(bottleTombstones).values({
      bottleId: inactive.id,
      newBottleId: replacement.id,
    });
    const user = await fixtures.User({ mod: true });

    await expect(
      waitError(
        // SAFETY: This test sends the retired groupId field to the runtime validator.
        routerClient.bottleAliases.upsert(
          { bottle: 2_147_483_647, name: "Missing Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 404, message: "Bottle not found." });
    await expect(
      waitError(
        routerClient.bottleAliases.upsert(
          { bottle: inactive.id, name: "Inactive Bottle Alias" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 409 });
    await expect(
      waitError(
        routerClient.bottleAliases.upsert(
          { bottle: replacement.id, name: "conflicting direct alias" },
          { context: { user } },
        ),
      ),
    ).resolves.toMatchObject({
      status: 409,
      message:
        'Cannot reserve exact Bottle alias "Conflicting Direct Alias": another_bottle.',
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
        routerClient.bottleAliases.upsert(
          // SAFETY: This test sends the retired groupId field to the runtime validator.
          {
            bottle: bottle.id,
            groupId: bottle.groupId,
            name: "Group Target Alias",
          } as never,
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchObject({ status: 400 });

    await expect(
      waitError(
        routerClient.bottleAliases.upsert(
          { bottle: bottle.id, name: "Unauthorized Alias" },
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
      routerClient.bottleAliases.upsert(
        { bottle: bottle.id, name: "Queue Failure Alias" },
        { context: { user } },
      ),
    ).resolves.toEqual({});
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Queue Failure Alias"),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
  });
});
