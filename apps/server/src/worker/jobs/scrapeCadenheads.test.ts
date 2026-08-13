import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeCadenheads, { scrapeProducts } from "./scrapeCadenheads";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.cadenhead.shop/wp-json/wc/store/v1/products?category=whisky&per_page=100&stock_status=instock&page=1";
const secondPageUrl =
  "https://www.cadenhead.shop/wp-json/wc/store/v1/products?category=whisky&per_page=100&stock_status=instock&page=2";
const thirdPageUrl =
  "https://www.cadenhead.shop/wp-json/wc/store/v1/products?category=whisky&per_page=100&stock_status=instock&page=3";

test("routes the Cadenhead's source to its scraper job", () => {
  expect(getJobForSite("cadenheads")).toBe("ScrapeCadenheads");
});

test("scrapes purchasable bottles and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("cadenheads", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl: "https://www.cadenhead.shop/wp-content/uploads/glen-spey.png",
      name: "Cadenhead's Glen Spey-Glenlivet 16-year-old 54.7% abv 70cl Single Malt Whisky",
      price: 7500,
      url: "https://www.cadenhead.shop/product/glen-spey-glenlivet-16yo/",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "Campbeltown Loch (46% 70cl Blended Malt Scotch Whisky)",
      price: 4300,
      url: "https://www.cadenhead.shop/product/campbeltown-loch/",
      volume: 700,
    },
  ]);
});

test("rejects malformed WooCommerce payloads", async ({ axiosMock }) => {
  axiosMock.onGet(firstPageUrl).reply(200, [{ name: "Broken" }]);

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("cadenheads", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, []);

  await expect(scrapeCadenheads({ dryRun: true })).resolves.toBe(2);
});

test("continues after a page whose products are all filtered", async ({
  axiosMock,
}) => {
  const result: Array<{ name?: unknown }> = JSON.parse(
    await loadFixture("cadenheads", "bottle-list.json"),
  );
  const filteredProduct = result.find(
    (product) => product.name === "Unavailable Tullibardine 11yo 70cl",
  );
  expect(filteredProduct).toBeDefined();

  axiosMock.onGet(firstPageUrl).reply(200, [filteredProduct]);
  axiosMock.onGet(secondPageUrl).reply(200, result);
  axiosMock.onGet(thirdPageUrl).reply(200, []);

  await expect(scrapeCadenheads({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(3);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, []);

  await expect(scrapeCadenheads({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
