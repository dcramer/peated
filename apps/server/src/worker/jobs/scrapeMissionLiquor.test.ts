import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeMissionLiquor, { scrapeProducts } from "./scrapeMissionLiquor";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.missionliquor.com/collections/whiskey/products.json?limit=250&page=1";
const secondPageUrl =
  "https://www.missionliquor.com/collections/whiskey/products.json?limit=250&page=2";

test("routes the Mission Liquor source to its scraper job", () => {
  expect(getJobForSite("missionliquor")).toBe("ScrapeMissionLiquor");
});

test("scrapes available single bottles and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("missionliquor", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/eh-taylor.png",
      name: "E.H. Taylor Small Batch Bottled In Bond Kentucky Straight Bourbon Whiskey",
      price: 4999,
      url: "https://www.missionliquor.com/products/eh-taylor-small-batch",
      volume: 750,
    },
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/macallan.png",
      name: "The Macallan Sherry Oak Single Malt Scotch Whisky 12-year-old",
      price: 8999,
      url: "https://www.missionliquor.com/products/macallan-sherry-oak-12",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/minor-case.png",
      name: "Minor Case Sherry Cask Rye Whiskey",
      price: 4399,
      url: "https://www.missionliquor.com/products/minor-case-sherry-cask-rye",
      volume: 750,
    },
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/collector-truck.png",
      name: "Collector's Edition Semi Truck American Whiskey (IN STORE PICK UP ONLY)",
      price: 9999,
      url: "https://www.missionliquor.com/products/collectors-edition-semi-truck",
      volume: 1000,
    },
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/highland-harvest.png",
      name: "Highland Harvest Organic Blended Scotch Whiskey",
      price: 3599,
      url: "https://www.missionliquor.com/products/highland-harvest-organic",
      volume: 750,
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
  const result = await loadFixture("missionliquor", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, { products: [] });

  await expect(scrapeMissionLiquor({ dryRun: true })).resolves.toBe(5);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeMissionLiquor({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
