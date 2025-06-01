import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the worker client
vi.mock("@peated/server/worker/client");

describe("POST /bottle-aliases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("creates a new bottle alias", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottleAliases.upsert(
      {
        bottle: bottle.id,
        name: "New Alias",
      },
      { context: { user } }
    );

    expect(result).toEqual({});

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "New Alias"),
    });

    expect(alias).toBeDefined();
    expect(alias?.bottleId).toBe(bottle.id);
  });

  test("updates store prices with matching name", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const storePrice = await fixtures.StorePrice({
      name: "Test Alias",
      bottleId: null,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      {
        bottle: bottle.id,
        name: "Test Alias",
      },
      { context: { user } }
    );

    const updatedStorePrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, storePrice.id),
    });

    expect(updatedStorePrice?.bottleId).toBe(bottle.id);
  });

  test("updates reviews with matching name", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const review = await fixtures.Review({
      name: "Test Alias",
      bottleId: null,
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      {
        bottle: bottle.id,
        name: "Test Alias",
      },
      { context: { user } }
    );

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(updatedReview?.bottleId).toBe(bottle.id);
  });

  test("updates bottle image if store price has an image", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    const storePrice = await fixtures.StorePrice({
      name: "Test Alias",
      bottleId: null,
      imageUrl: "https://example.com/image.jpg",
    });
    const user = await fixtures.User({ mod: true });

    await routerClient.bottleAliases.upsert(
      {
        bottle: bottle.id,
        name: "Test Alias",
      },
      { context: { user } }
    );

    const updatedBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });

    expect(updatedBottle?.imageUrl).toBe("https://example.com/image.jpg");
  });

  test("throws NOT_FOUND for non-existent bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottleAliases.upsert(
        {
          bottle: 9999,
          name: "Test Alias",
        },
        { context: { user } }
      )
    );

    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("requires mod permission", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottleAliases.upsert(
        {
          bottle: bottle.id,
          name: "Test Alias",
        },
        { context: { user } }
      )
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("throws error for duplicate alias on different bottle", async ({
    fixtures,
  }) => {
    const bottle1 = await fixtures.Bottle();
    const bottle2 = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle1.id,
      name: "Duplicate Alias",
    });
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottleAliases.upsert(
        {
          bottle: bottle2.id,
          name: "Duplicate Alias",
        },
        { context: { user } }
      )
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Duplicate alias found (1). Not implemented.]`
    );
  });
});
