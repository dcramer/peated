import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeSingleCaskNation, {
  scrapeProducts,
} from "./scrapeSingleCaskNation";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://singlecasknation.com/collections/frontpage/products.json?limit=250&page=1&country=US";

test("scrapes every supported whisky type and excludes ineligible records", async ({
  axiosMock,
}) => {
  const result = await loadFixture("singlecasknation", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      barcode: "036602301979",
      currency: "usd",
      externalProductId: "9031243464902",
      imageUrl: "https://cdn.shopify.com/s/files/rock-town-10.png",
      name: "Single Cask Nation Rock Town 10-year-old",
      price: 9000,
      url: "https://singlecasknation.com/products/rock-town-10-year-old",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: null,
      name: "Single Cask Nation Balcones 6-year-old",
      price: 8050,
      url: "https://singlecasknation.com/products/balcones-6-year-old",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: null,
      name: "Single Cask Nation Backwoods 4-year-old",
      price: 9500,
      url: "https://singlecasknation.com/products/backwoods-4-year-old",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: null,
      name: "Single Cask Nation Girvan 33-year-old",
      price: 25500,
      url: "https://singlecasknation.com/products/girvan-33-year-old",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: null,
      name: "Single Cask Nation Ben Nevis 8-year-old",
      price: 9000,
      url: "https://singlecasknation.com/products/ben-nevis-8-year-old",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: null,
      name: "Single Cask Nation New York Distilling 10-year-old",
      price: 10000,
      url: "https://singlecasknation.com/products/new-york-distilling-10-year-old",
      volume: 700,
    },
  ]);
});

test("rejects malformed Shopify payloads", async ({ axiosMock }) => {
  axiosMock.onGet(firstPageUrl).reply(200, {
    products: [{ title: "Broken" }],
  });

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("singlecasknation", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet(
      "https://singlecasknation.com/collections/frontpage/products.json?limit=250&page=2&country=US",
    )
    .reply(200, { products: [] });

  await expect(scrapeSingleCaskNation({ dryRun: true })).resolves.toBe(6);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeSingleCaskNation({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
