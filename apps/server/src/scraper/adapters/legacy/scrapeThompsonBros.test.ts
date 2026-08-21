import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeThompsonBros, { scrapeProducts } from "./scrapeThompsonBros";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.thompsonbrosdistillers.com/wp-json/wc/store/v1/products?category=18&per_page=100&stock_status=instock&page=1";

test("scrapes purchasable whisky bottles and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("thompsonbros", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      barcode: "036602301979",
      currency: "gbp",
      externalProductId: "109292",
      imageUrl:
        "https://www.thompsonbrosdistillers.com/wp-content/uploads/glen-scotia.png",
      name: "Thompson Bros Glen Scotia Single Malt Scotch Whisky, 2013, 12-year-old, 70CL, 56.7%ABV",
      price: 5833,
      url: "https://www.thompsonbrosdistillers.com/product/glen-scotia-2013/",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "Thompson Bros Mystery Malt – Series 6, 0.7 L",
      price: 5417,
      url: "https://www.thompsonbrosdistillers.com/product/mystery-malt-series-6/",
      volume: 700,
    },
  ]);
});

test("rejects malformed top-level WooCommerce payloads", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("thompsonbros", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet(
      "https://www.thompsonbrosdistillers.com/wp-json/wc/store/v1/products?category=18&per_page=100&stock_status=instock&page=2",
    )
    .reply(200, []);

  await expect(scrapeThompsonBros({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, []);

  await expect(scrapeThompsonBros({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
