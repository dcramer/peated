import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeSingleCaskNation, {
  parseReleaseMonth,
  scrapeProducts,
} from "./scrapeSingleCaskNation";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://singlecasknation.com/collections/frontpage/products.json?limit=250&page=1&country=US";

function mockProductPages(axiosMock: any) {
  axiosMock
    .onGet(/^https:\/\/singlecasknation\.com\/products\//u)
    .reply(200, "<p>October 2024 Online Exclusive Release</p>");
}

test("parses a source-stated release month without inventing a day", () => {
  expect(
    parseReleaseMonth(
      "<div>October 2024 <strong>Online Exclusive Release</strong></div>",
    ),
  ).toEqual({ releaseYear: 2024, releaseMonth: 10 });
  expect(parseReleaseMonth("October release")).toBeNull();
});

test("scrapes every supported whisky type and excludes ineligible records", async ({
  axiosMock,
}) => {
  const result = await loadFixture("singlecasknation", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  mockProductPages(axiosMock);

  const items: unknown[] = [];
  const identities: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    const { sourceBottleIdentity, ...price } =
      StorePriceInputSchema.parse(item);
    identities.push(sourceBottleIdentity);
    items.push(price);
  });

  expect(identities).toMatchObject([
    { category: "bourbon", release_year: 2024, release_month: 10 },
    { category: "single_malt", release_year: 2024, release_month: 10 },
    { category: "rye", release_year: 2024, release_month: 10 },
    { category: "single_grain", release_year: 2024, release_month: 10 },
    { category: "single_malt", release_year: 2024, release_month: 10 },
    { category: "rye", release_year: 2024, release_month: 10 },
  ]);

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

test("uses a saved release without fetching its product page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("singlecasknation", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  mockProductPages(axiosMock);

  const releases: Array<
    [number | null | undefined, number | null | undefined]
  > = [];
  const loadedProductIds: string[][] = [];
  await scrapeProducts(
    firstPageUrl,
    async (item) => {
      const identity = StorePriceInputSchema.parse(item).sourceBottleIdentity;
      releases.push([identity?.release_year, identity?.release_month]);
    },
    async (externalProductIds) => {
      loadedProductIds.push(externalProductIds);
      return new Map([
        ["9031243464902", { releaseYear: 2025, releaseMonth: 11 }],
      ]);
    },
  );

  expect(loadedProductIds).toEqual([["9031243464902"]]);
  expect(releases[0]).toEqual([2025, 11]);
  expect(
    axiosMock.history.get.some(
      ({ url }: { url?: string }) =>
        url === "https://singlecasknation.com/products/rock-town-10-year-old",
    ),
  ).toBe(false);
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
  mockProductPages(axiosMock);
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
