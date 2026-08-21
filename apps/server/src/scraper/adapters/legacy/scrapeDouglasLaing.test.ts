import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeDouglasLaing, {
  parseDouglasLaingProducts,
  scrapeProducts,
} from "./scrapeDouglasLaing";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.douglaslaing.com/en-us/collections/scotch-whisky/products.json?limit=250&page=1";

test("scrapes supported bottles and excludes non-bottle records", async ({
  axiosMock,
}) => {
  const result = await loadFixture("douglaslaing", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    expect.objectContaining({
      barcode: "036602301979",
      currency: "usd",
      externalProductId: "6714331496619",
      imageUrl: "https://cdn.shopify.com/s/files/big-peat-football.png",
      name: "Big Peat The World Football Edition 2026",
      price: 6500,
      url: "https://www.douglaslaing.com/en-us/products/big-peat-the-world-football-edition-2026",
      volume: 700,
      sourceBottleIdentity: expect.objectContaining({
        brand: "Big Peat",
        expression: "The World Football Edition 2026",
        category: "blend",
        abv: 48,
      }),
    }),
    expect.objectContaining({
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/rangers-girvan.png",
      name: "Rangers Girvan 17-year-old",
      price: 8750,
      url: "https://www.douglaslaing.com/en-us/products/rangers-girvan-17-years-old",
      volume: 500,
      sourceBottleIdentity: expect.objectContaining({
        brand: "Rangers",
        expression: "Girvan 17-year-old",
        category: "single_grain",
        stated_age: 17,
        abv: 50,
      }),
    }),
    expect.objectContaining({
      currency: "usd",
      imageUrl: null,
      name: "XOP North British 35-year-old",
      price: 42500,
      url: "https://www.douglaslaing.com/en-us/products/xop-north-british-35-years-old",
      volume: 700,
      sourceBottleIdentity: expect.objectContaining({
        brand: "XOP",
        expression: "North British 35-year-old",
        category: "single_grain",
        stated_age: 35,
        abv: null,
      }),
    }),
    expect.objectContaining({
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/the-gauldrons-eclipse.png",
      name: "The Gauldrons Eclipse",
      price: 7200,
      url: "https://www.douglaslaing.com/en-us/products/the-gauldrons-eclipse",
      volume: 700,
      sourceBottleIdentity: expect.objectContaining({
        brand: "The Gauldrons",
        bottler: null,
        expression: "Eclipse – Finished in Orange Wine Casks",
        category: "blend",
        abv: 52.9,
        release_year: null,
      }),
    }),
  ]);
});

test("rejects malformed Shopify payloads", async ({ axiosMock }) => {
  axiosMock.onGet(firstPageUrl).reply(200, {
    products: [{ title: "Broken" }],
  });

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("does not promote a disagreeing vendor or routine cask tag to identity", () => {
  const [listing] = parseDouglasLaingProducts(
    {
      products: [
        {
          title: "Independent Label Reserve",
          handle: "independent-label-reserve",
          vendor: "Douglas Laing",
          product_type: "Single Malt",
          tags: ["Abv: 46", "Cask: Bourbon Barrel", "Vol: 70"],
          images: [],
          variants: [{ available: true, price: "60.00" }],
        },
      ],
    },
    firstPageUrl,
  );

  expect(listing?.sourceBottleIdentity).toMatchObject({
    brand: null,
    expression: "Independent Label Reserve",
    category: "single_malt",
    abv: 46,
    cask_type: null,
  });
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("douglaslaing", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet(
      "https://www.douglaslaing.com/en-us/collections/scotch-whisky/products.json?limit=250&page=2",
    )
    .reply(200, { products: [] });

  await expect(scrapeDouglasLaing({ dryRun: true })).resolves.toBe(4);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeDouglasLaing({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
