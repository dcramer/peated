import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeNorthStarSpirits, {
  scrapeProducts,
} from "./scrapeNorthStarSpirits";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://northstarspirits.com/collections/shop/products.json?limit=250&page=1";

test("scrapes live whisky listings and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("northstarspirits", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/speyside-connection.png",
      name: "The Speyside Connection",
      price: 6999,
      url: "https://northstarspirits.com/products/speyside-connection",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "Caol Ila Sherry Octave",
      price: 5700,
      url: "https://northstarspirits.com/products/caol-ila-sherry-octave",
      volume: 500,
    },
  ]);
});

test("rejects malformed Shopify payloads", async ({ axiosMock }) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [{ title: "Broken" }] });

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("northstarspirits", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet(
      "https://northstarspirits.com/collections/shop/products.json?limit=250&page=2",
    )
    .reply(200, { products: [] });

  await expect(scrapeNorthStarSpirits({ dryRun: true })).resolves.toBe(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeNorthStarSpirits({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
