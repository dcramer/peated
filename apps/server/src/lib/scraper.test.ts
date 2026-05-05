import { orpcClient } from "@peated/server/lib/orpc-client/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import scrapePrices, {
  type ScrapePricesCallback,
  type StorePrice,
} from "./scraper";
import waitError from "./test/waitError";

vi.mock("@peated/server/lib/orpc-client/server", () => ({
  orpcClient: {
    prices: {
      createBatch: vi.fn(),
    },
  },
}));

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
