import { db } from "@peated/server/db";
import { bottles, entities, storePrices } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import scrapePrices, {
  handleBottle,
  type ScrapePricesCallback,
  type StorePrice,
} from "./scraper";
import waitError from "./test/waitError";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("handleBottle", () => {
  const bottleInput = {
    name: "Cask No. 1.2",
    brand: { name: "System Scraper Brand" },
    statedAge: 12,
    edition: "Batch 3",
    abv: 57.2,
    singleCask: true,
    category: "single_malt" as const,
  };
  const priceInput = {
    name: "System Scraper Brand Cask No. 1.2",
    price: 12_000,
    currency: "usd" as const,
    url: "https://example.com/products/1-2",
    volume: 700,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists without a user token and attributes the Bottle to Peated", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const previousAccessToken = process.env.ACCESS_TOKEN;
    delete process.env.ACCESS_TOKEN;

    try {
      await handleBottle(bottleInput, priceInput);
    } finally {
      if (previousAccessToken === undefined) {
        delete process.env.ACCESS_TOKEN;
      } else {
        process.env.ACCESS_TOKEN = previousAccessToken;
      }
    }

    const systemActor = await getPeatedSystemActor();
    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.createdByActorId, systemActor.id),
    });
    expect(bottle).toMatchObject({
      createdByActorId: systemActor.id,
      edition: bottleInput.edition,
      statedAge: bottleInput.statedAge,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: and(
          eq(storePrices.externalSiteId, site.id),
          eq(storePrices.price, priceInput.price),
        ),
      }),
    ).toMatchObject({ price: priceInput.price });
  });

  it("updates the canonical Bottle when repeated ingestion conflicts", async () => {
    await handleBottle({ ...bottleInput, description: "Initial description" });
    await handleBottle({ ...bottleInput, description: "Updated description" });

    const matchingBottles = await db.query.bottles.findMany();
    expect(matchingBottles).toHaveLength(1);
    expect(matchingBottles[0]).toMatchObject({
      description: "Updated description",
    });
  });

  it("rejects invalid flat Bottle input before persistence", async () => {
    await expect(handleBottle({ ...bottleInput, name: "" })).rejects.toThrow();

    expect(
      await db.query.entities.findFirst({
        where: eq(entities.name, bottleInput.brand.name),
      }),
    ).toBeUndefined();
  });

  it("requires dry-run explicitly and skips persistence", async () => {
    await handleBottle(bottleInput, priceInput, null, { dryRun: true });

    expect(
      await db.query.entities.findFirst({
        where: eq(entities.name, bottleInput.brand.name),
      }),
    ).toBeUndefined();
  });
});

describe("scrapePrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scrapes pages and persists the discovered prices", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const urlForPage = (page: number) => `https://test.com/page/${page}`;
    const scrapeProducts = vi.fn(
      async (url: string, cb: ScrapePricesCallback) => {
        if (url === urlForPage(1)) {
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
        } else if (url === urlForPage(2)) {
          await cb({
            name: "Product 3",
            price: 3000,
            currency: "usd",
            url: "https://test.com/product3",
            volume: 750,
          });
        }
      },
    );

    await scrapePrices(site.type, urlForPage, scrapeProducts);

    expect(scrapeProducts).toHaveBeenCalledTimes(3);
    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
        orderBy: (table, { asc }) => asc(table.name),
      }),
    ).toMatchObject([
      { name: "Product 1", price: 1000 },
      { name: "Product 2", price: 2000 },
      { name: "Product 3", price: 3000 },
    ]);
  });

  it("deduplicates same-name same-volume products", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const scrapeProducts = async (url: string, cb: ScrapePricesCallback) => {
      if (!url.endsWith("/1")) return;
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
    };

    await scrapePrices(
      site.type,
      (page) => `https://test.com/page/${page}`,
      scrapeProducts,
    );

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject([
      {
        name: "Product 1",
        price: 1000,
        url: "https://test.com/product1",
      },
    ]);
  });

  it("keeps same-name products with different volumes", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
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
    const scrapeProducts = async (url: string, cb: ScrapePricesCallback) => {
      if (!url.endsWith("/1")) return;
      for (const price of prices) await cb(price);
    };

    await scrapePrices(
      site.type,
      (page) => `https://test.com/page/${page}`,
      scrapeProducts,
    );

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(2);
  });

  it("throws when no products are found", async () => {
    const error = await waitError(() =>
      scrapePrices(
        "totalwine",
        (page) => `https://test.com/page/${page}`,
        async () => undefined,
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Failed to scrape any products.]`,
    );
  });

  it("does not persist an explicit dry run", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const scrapeProducts = async (url: string, cb: ScrapePricesCallback) => {
      if (!url.endsWith("/1")) return;
      await cb({
        name: "Dry Run Product",
        price: 1000,
        currency: "usd",
        url: "https://test.com/dry-run",
        volume: 750,
      });
    };

    await scrapePrices(
      site.type,
      (page) => `https://test.com/page/${page}`,
      scrapeProducts,
      { dryRun: true },
    );

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
  });
});
