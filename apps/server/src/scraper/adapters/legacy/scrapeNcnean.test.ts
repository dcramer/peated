import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeNcnean, { scrapeProducts } from "./scrapeNcnean";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://ncnean.com/collections/all/products.json?country=GB&limit=250&page=1";
const secondPageUrl =
  "https://ncnean.com/collections/all/products.json?country=GB&limit=250&page=2";

test("scrapes available full-size whisky and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("ncnean", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      barcode: "036602301979",
      currency: "gbp",
      externalProductId: "15761596776830",
      imageUrl: "https://cdn.shopify.com/s/files/ncnean-aon.png",
      name: "Nc'nean Aon 17-163 Madeira Cask (Single Cask)",
      price: 9495,
      url: "https://ncnean.com/products/aon-17-163-madeira-single-cask",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://ncnean.com/cdn/shop/files/organic.png",
      name: "Nc'nean Organic Single Malt Scotch Whisky",
      price: 5595,
      url: "https://ncnean.com/products/organic-single-malt",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/quiet-rebels-simon.png",
      name: "Nc'nean Quiet Rebels: Simon (Limited Edition)",
      price: 7995,
      url: "https://ncnean.com/products/quiet-rebels-simon",
      volume: 700,
    },
  ]);
});

test("rejects malformed Shopify payloads", async ({ axiosMock }) => {
  axiosMock.onGet(firstPageUrl).reply(200, { items: [] });

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("ncnean", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, { products: [] });

  await expect(scrapeNcnean({ dryRun: true })).resolves.toBe(3);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeNcnean({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
