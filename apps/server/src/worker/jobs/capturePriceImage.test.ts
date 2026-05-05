import { db } from "@peated/server/db";
import { bottles, storePrices } from "@peated/server/db/schema";
import * as uploads from "@peated/server/lib/uploads";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import capturePriceImage from "./capturePriceImage";

vi.mock("@peated/server/lib/uploads", () => ({
  compressAndResizeImage: vi.fn((stream, filename) => ({
    stream,
    filename: `${filename}.webp`,
  })),
  storeFile: vi.fn(async () => "/uploads/price-image.webp"),
}));

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: vi.fn(),
}));

describe("capturePriceImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("image-bytes")),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("stores the price image without promoting it to the bottle before review", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      imageUrl: null,
    });

    await capturePriceImage({
      priceId: price.id,
      imageUrl: "https://example.com/image.jpg",
    });

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const updatedBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });

    expect(uploads.storeFile).toHaveBeenCalled();
    expect(updatedPrice?.imageUrl).toBe("/uploads/price-image.webp");
    expect(updatedBottle?.imageUrl).toBeNull();
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: price.id,
      },
    );
  });
});
