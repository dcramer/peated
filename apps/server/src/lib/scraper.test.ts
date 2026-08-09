import { ORPCError } from "@orpc/client";
import { orpcClient } from "@peated/server/lib/orpc-client/server";
import type { BottleSchema } from "@peated/server/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import scrapePrices, {
  handleBottle,
  type ScrapePricesCallback,
  type StorePrice,
} from "./scraper";
import waitError from "./test/waitError";

vi.mock("@peated/server/lib/orpc-client/server", () => ({
  orpcClient: {
    bottles: {
      create: vi.fn(),
      update: vi.fn(),
      imageUpdate: vi.fn(),
    },
    prices: {
      createBatch: vi.fn(),
    },
  },
}));

function bottleResult({
  bottleId,
  imageUrl = null,
}: {
  bottleId: number;
  imageUrl?: string | null;
}): z.infer<typeof BottleSchema> {
  return {
    id: bottleId,
    imageUrl,
  } as z.infer<typeof BottleSchema>;
}

describe("handleBottle", () => {
  const originalAccessToken = process.env.ACCESS_TOKEN;
  const bottleInput = {
    name: "Cask No. 1.2",
    brand: 7,
    statedAge: 12,
    edition: "Batch 3",
    abv: 57.2,
    singleCask: true,
    category: "single_malt" as const,
  };
  const priceInput = {
    name: "Cask No. 1.2",
    price: 12_000,
    currency: "usd" as const,
    url: "https://example.com/products/1-2",
    volume: 700,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ACCESS_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.resetAllMocks();
    if (originalAccessToken === undefined) {
      delete process.env.ACCESS_TOKEN;
    } else {
      process.env.ACCESS_TOKEN = originalAccessToken;
    }
    vi.unstubAllGlobals();
  });

  it("creates a Bottle and consumes it directly for image upload", async () => {
    const bottle = bottleResult({ bottleId: 41 });
    const imageBlob = new Blob(["image"]);
    vi.mocked(orpcClient.bottles.create).mockResolvedValue(bottle);
    vi.mocked(orpcClient.bottles.imageUpdate).mockResolvedValue({
      imageUrl: "https://api.example.com/uploads/bottles/1.webp",
    });
    vi.mocked(orpcClient.prices.createBatch).mockResolvedValue({} as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(imageBlob) }),
    );

    await handleBottle(
      bottleInput,
      priceInput,
      "https://example.com/images/1-2.jpg",
    );

    expect(orpcClient.bottles.create).toHaveBeenCalledOnce();
    const [createInput] = vi.mocked(orpcClient.bottles.create).mock.calls[0];
    expect(createInput).toMatchObject({
      name: bottleInput.name,
      brand: bottleInput.brand,
      statedAge: bottleInput.statedAge,
      edition: bottleInput.edition,
      abv: bottleInput.abv,
      singleCask: bottleInput.singleCask,
      category: bottleInput.category,
    });
    expect(createInput).not.toHaveProperty("imageUrl");
    expect(createInput).not.toHaveProperty("image");
    expect(orpcClient.bottles.update).not.toHaveBeenCalled();
    expect(orpcClient.bottles.imageUpdate).toHaveBeenCalledWith({
      bottle: bottle.id,
      file: imageBlob,
    });
    expect(orpcClient.prices.createBatch).toHaveBeenCalledWith({
      site: "smws",
      prices: [priceInput],
    });
  });

  it("directs a canonical create conflict to the strict Bottle update", async () => {
    const conflictBottleId = 52;
    const bottle = bottleResult({ bottleId: conflictBottleId });
    vi.mocked(orpcClient.bottles.create).mockRejectedValue(
      new ORPCError("CONFLICT", {
        defined: true,
        data: { bottle: conflictBottleId },
      }),
    );
    vi.mocked(orpcClient.bottles.update).mockResolvedValue(bottle);

    await handleBottle(bottleInput);

    expect(orpcClient.bottles.update).toHaveBeenCalledOnce();
    expect(orpcClient.bottles.update).toHaveBeenCalledWith({
      bottle: conflictBottleId,
      shared: expect.objectContaining({
        name: bottleInput.name,
        statedAge: bottleInput.statedAge,
        brand: bottleInput.brand,
        category: bottleInput.category,
      }),
      exact: expect.objectContaining({
        edition: bottleInput.edition,
        abv: bottleInput.abv,
        singleCask: bottleInput.singleCask,
      }),
    });
    const [updateInput] = vi.mocked(orpcClient.bottles.update).mock.calls[0];
    expect(updateInput.exact).not.toHaveProperty("statedAge");
    expect(orpcClient.bottles.imageUpdate).not.toHaveBeenCalled();
  });

  it("stops after a non-conflict create failure", async () => {
    vi.mocked(orpcClient.bottles.create).mockRejectedValue(
      new Error("API unavailable"),
    );

    await handleBottle(bottleInput, priceInput);

    expect(orpcClient.bottles.update).not.toHaveBeenCalled();
    expect(orpcClient.bottles.imageUpdate).not.toHaveBeenCalled();
    expect(orpcClient.prices.createBatch).not.toHaveBeenCalled();
  });

  it("does not call the API when flat input cannot satisfy Bottle creation", async () => {
    await handleBottle({ ...bottleInput, name: "" }, priceInput);

    expect(orpcClient.bottles.create).not.toHaveBeenCalled();
    expect(orpcClient.bottles.update).not.toHaveBeenCalled();
    expect(orpcClient.prices.createBatch).not.toHaveBeenCalled();
  });

  it("stops after the conflict-directed update fails", async () => {
    vi.mocked(orpcClient.bottles.create).mockRejectedValue(
      new ORPCError("CONFLICT", {
        defined: true,
        data: { bottle: 63 },
      }),
    );
    vi.mocked(orpcClient.bottles.update).mockRejectedValue(
      new ORPCError("BAD_REQUEST", { defined: true }),
    );

    await handleBottle(bottleInput, priceInput);

    expect(orpcClient.bottles.imageUpdate).not.toHaveBeenCalled();
    expect(orpcClient.prices.createBatch).not.toHaveBeenCalled();
  });

  it("continues price ingestion when image transfer fails", async () => {
    vi.mocked(orpcClient.bottles.create).mockResolvedValue(
      bottleResult({ bottleId: 74 }),
    );
    vi.mocked(orpcClient.prices.createBatch).mockResolvedValue({} as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("image down")));

    await handleBottle(
      bottleInput,
      priceInput,
      "https://example.com/images/1-2.jpg",
    );

    expect(orpcClient.bottles.imageUpdate).not.toHaveBeenCalled();
    expect(orpcClient.prices.createBatch).toHaveBeenCalledWith({
      site: "smws",
      prices: [priceInput],
    });
  });
});

describe("scrapePrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should scrape prices and submit them in batches", async () => {
    const mockSite = "totalwine";
    const mockUrlFn = (page: number) => `https://test.com/page/${page}`;
    const mockScrapeProducts = vi.fn(
      async (url: string, cb: ScrapePricesCallback) => {
        if (url === "https://test.com/page/1") {
          await cb({
            name: "Product 1",
            price: 1000,
            currency: "usd",
            url: "https://test.com/product1",
            volume: 750,
          });
          await cb({
            name: "Product 2",
            price: 2000,
            currency: "usd",
            url: "https://test.com/product2",
            volume: 750,
          });
        } else if (url === "https://test.com/page/2") {
          await cb({
            name: "Product 3",
            price: 3000,
            currency: "usd",
            url: "https://test.com/product3",
            volume: 750,
          });
        } else {
          // No more products
        }
      },
    );

    await scrapePrices(mockSite, mockUrlFn, mockScrapeProducts);

    expect(mockScrapeProducts).toHaveBeenCalledTimes(3);
    expect(orpcClient.prices.createBatch).toHaveBeenCalledWith({
      site: mockSite,
      prices: [
        {
          name: "Product 1",
          price: 1000,
          currency: "usd",
          url: "https://test.com/product1",
          volume: 750,
        },
        {
          name: "Product 2",
          price: 2000,
          currency: "usd",
          url: "https://test.com/product2",
          volume: 750,
        },
        {
          name: "Product 3",
          price: 3000,
          currency: "usd",
          url: "https://test.com/product3",
          volume: 750,
        },
      ],
    });
  });

  it("should handle duplicate products", async () => {
    const mockSite = "totalwine";
    const mockUrlFn = (page: number) => `https://test.com/page/${page}`;
    const mockScrapeProducts = vi.fn(
      async (url: string, cb: ScrapePricesCallback) => {
        if (url === "https://test.com/page/1") {
          await cb({
            name: "Product 1",
            price: 1000,
            currency: "usd",
            url: "https://test.com/product1",
            volume: 750,
          });
          await cb({
            name: "Product 1",
            price: 1000,
            currency: "usd",
            url: "https://test.com/product1",
            volume: 750,
          }); // Duplicate
        } else {
          // No more products
        }
      },
    );

    await scrapePrices(mockSite, mockUrlFn, mockScrapeProducts);

    expect(mockScrapeProducts).toHaveBeenCalledTimes(2);
    expect(orpcClient.prices.createBatch).toHaveBeenCalledWith({
      site: mockSite,
      prices: [
        {
          name: "Product 1",
          price: 1000,
          currency: "usd",
          url: "https://test.com/product1",
          volume: 750,
        },
      ],
    });
  });

  it("keeps same-name products with different volumes", async () => {
    const mockSite = "totalwine";
    const mockUrlFn = (page: number) => `https://test.com/page/${page}`;
    const prices: StorePrice[] = [
      {
        name: "Product 1",
        price: 1000,
        currency: "usd",
        url: "https://test.com/product1-750",
        volume: 750,
      },
      {
        name: "Product 1",
        price: 1800,
        currency: "usd",
        url: "https://test.com/product1-1750",
        volume: 1750,
      },
    ];
    const mockScrapeProducts = vi.fn(
      async (url: string, cb: ScrapePricesCallback) => {
        if (url !== "https://test.com/page/1") {
          return;
        }

        for (const price of prices) {
          await cb(price);
        }
      },
    );

    await scrapePrices(mockSite, mockUrlFn, mockScrapeProducts);

    expect(orpcClient.prices.createBatch).toHaveBeenCalledWith({
      site: mockSite,
      prices,
    });
  });

  it("deduplicates same-name same-volume products with different URLs", async () => {
    const mockSite = "totalwine";
    const mockUrlFn = (page: number) => `https://test.com/page/${page}`;
    const mockScrapeProducts = vi.fn(
      async (url: string, cb: ScrapePricesCallback) => {
        if (url !== "https://test.com/page/1") {
          return;
        }

        await cb({
          name: "Product 1",
          price: 1000,
          currency: "usd",
          url: "https://test.com/product1",
          volume: 750,
        });
        await cb({
          name: "Product 1",
          price: 1100,
          currency: "usd",
          url: "https://test.com/product1-special",
          volume: 750,
        });
      },
    );

    await scrapePrices(mockSite, mockUrlFn, mockScrapeProducts);

    expect(orpcClient.prices.createBatch).toHaveBeenCalledWith({
      site: mockSite,
      prices: [
        {
          name: "Product 1",
          price: 1000,
          currency: "usd",
          url: "https://test.com/product1",
          volume: 750,
        },
      ],
    });
  });

  it("should throw an error if no products are found", async () => {
    const mockSite = "totalwine";
    const mockUrlFn = (page: number) => `https://test.com/page/${page}`;
    const mockScrapeProducts = vi.fn(async () => {
      // No products
    });

    const error = await waitError(() =>
      scrapePrices(mockSite, mockUrlFn, mockScrapeProducts),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Failed to scrape any products.]`,
    );
  });
});
