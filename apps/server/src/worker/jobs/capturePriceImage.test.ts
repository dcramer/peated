import { db } from "@peated/server/db";
import { bottles, storePrices } from "@peated/server/db/schema";
import type * as uploads from "@peated/server/lib/uploads";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import type * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import capturePriceImageWithServices, {
  type CapturePriceImageServices,
} from "./capturePriceImage";

const fetchImage = vi.fn<typeof fetch>();
const queueResolution = vi.fn<typeof workerClient.pushUniqueJob>();
const storeImage = vi.fn<typeof uploads.storeFile>();
const services: CapturePriceImageServices = {
  compressImage: compressAndResizeImage,
  fetchImage,
  queueResolution,
  storeImage,
};

function capturePriceImage(
  input: Parameters<typeof capturePriceImageWithServices>[0],
) {
  return capturePriceImageWithServices(input, undefined, services);
}

describe("capturePriceImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchImage.mockResolvedValue(new Response("image-bytes"));
    storeImage.mockResolvedValue("/uploads/price-image.webp");
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

    expect(storeImage).toHaveBeenCalled();
    expect(updatedPrice?.imageUrl).toBe("/uploads/price-image.webp");
    expect(updatedBottle?.imageUrl).toBeNull();
    expect(queueResolution).toHaveBeenCalledWith("ResolveStorePriceBottle", {
      priceId: price.id,
    });
  });
});
