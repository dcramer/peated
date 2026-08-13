import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  entities,
  storePrices,
} from "@peated/server/db/schema";
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

  it("treats an SMWS subtitle rename as an alias for the same cask", async () => {
    const society = "The Scotch Malt Whisky Society";
    const originalName = "35.331 Ultra hoggie";
    const renamedName = "35.331 Citrus on the sea";
    const sharedInput = {
      brand: { name: society },
      bottler: { name: society },
      statedAge: 9,
      abv: 60.2,
      singleCask: true,
      category: "single_malt" as const,
    };

    await handleBottle({ ...sharedInput, name: originalName });
    const [original] = await db.select().from(bottles);
    expect(original).toBeDefined();

    await handleBottle({ ...sharedInput, name: renamedName });

    const persisted = await db.select().from(bottles);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      id: original!.id,
      name: expect.stringContaining(renamedName),
    });
    expect(
      await db
        .select({ bottleId: bottleAliases.bottleId, name: bottleAliases.name })
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, original!.id)),
    ).toContainEqual({
      bottleId: original!.id,
      name: original!.fullName,
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

  it("uses source products rather than emitted products to continue pagination", async () => {
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
          return { hasSourceProducts: true };
        }
        if (url === urlForPage(2)) {
          return { hasSourceProducts: true };
        }
        if (url === urlForPage(3)) {
          await cb({
            name: "Product 2",
            price: 2000,
            currency: "usd",
            url: "https://test.com/product2",
            volume: 750,
          });
          return { hasSourceProducts: true };
        }
        return { hasSourceProducts: false };
      },
    );

    await expect(
      scrapePrices("totalwine", urlForPage, scrapeProducts, { dryRun: true }),
    ).resolves.toBe(2);
    expect(scrapeProducts).toHaveBeenCalledTimes(4);
  });

  it("flushes queued prices before propagating a later page failure", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const urlForPage = (page: number) => `https://test.com/page/${page}`;
    const scrapeProducts = async (url: string, cb: ScrapePricesCallback) => {
      if (url === urlForPage(1)) {
        await cb({
          name: "Queued Product",
          price: 1000,
          currency: "usd",
          url: "https://test.com/queued-product",
          volume: 750,
        });
        return { hasSourceProducts: true };
      }
      throw new Error("Later page failed");
    };

    await expect(
      scrapePrices(site.type, urlForPage, scrapeProducts),
    ).rejects.toThrow("Later page failed");
    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject([{ name: "Queued Product", price: 1000 }]);
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

  it("propagates price persistence failures", async () => {
    const scrapeProducts = async (url: string, cb: ScrapePricesCallback) => {
      if (!url.endsWith("/1")) return;
      await cb({
        name: "Unpersisted Product",
        price: 1000,
        currency: "gbp",
        url: "https://test.com/unpersisted-product",
        volume: 700,
      });
    };

    await expect(
      scrapePrices(
        "bruichladdich",
        (page) => `https://test.com/page/${page}`,
        scrapeProducts,
      ),
    ).rejects.toThrow("External site not found: bruichladdich");
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
