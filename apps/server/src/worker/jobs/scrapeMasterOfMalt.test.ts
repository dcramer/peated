import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeMasterOfMalt, {
  parseMasterOfMaltProducts,
  scrapeProducts,
} from "./scrapeMasterOfMalt";

const searchUrl =
  "https://ll7rrres19-dsn.algolia.net/1/indexes/bc_e8lbekfe7c_1736038_d2c_variants/query";
const firstPartitionUrl = `${searchUrl}?x-algolia-agent=Peated%2F1.0+masterofmalt%2F1`;

test("routes the Master of Malt source to its scraper job", () => {
  expect(getJobForSite("masterofmalt")).toBe("ScrapeMasterOfMalt");
});

test("scrapes in-stock single bottles and excludes unsupported products", async ({
  axiosMock,
}) => {
  const fixture = JSON.parse(
    await loadFixture("masterofmalt", "bottle-list.json"),
  );
  axiosMock.onPost(firstPartitionUrl).reply(200, fixture);

  const items: unknown[] = [];
  await scrapeProducts(firstPartitionUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      barcode: "036602301979",
      currency: "gbp",
      externalProductId: "2444",
      imageUrl:
        "https://cdn11.bigcommerce.com/s-e8lbekfe7c/images/lagavulin.jpg",
      name: "Lagavulin 16-year-old",
      price: 7295,
      url: "https://www.masterofmalt.com/whiskies/lagavulin/lagavulin-16-year-old-whisky/?sku=2444",
      volume: 700,
    },
    {
      currency: "gbp",
      externalProductId: "JW-100CL",
      imageUrl:
        "https://cdn11.bigcommerce.com/s-e8lbekfe7c/images/johnnie-walker.jpg",
      name: "Johnnie Walker Island Green",
      price: 5600,
      url: "https://www.masterofmalt.com/whiskies/johnnie-walker/johnnie-walker-island-green-whisky/?sku=JW-100CL",
      volume: 1000,
    },
  ]);

  const request = JSON.parse(axiosMock.history.post[0].data);
  expect(request).toMatchObject({
    filters: expect.stringContaining(
      'categories_without_path:"Shop all whisky"',
    ),
    hitsPerPage: 1000,
    numericFilters: ["calculated_prices.GBP<40"],
  });
});

test("queries every bounded price partition before stopping", async ({
  axiosMock,
}) => {
  axiosMock
    .onPost(new RegExp(`^${searchUrl}`))
    .reply((request: { url?: string }) => {
      const agent = new URL(request.url!).searchParams.get("x-algolia-agent")!;
      const page = Number.parseInt(agent.split("/").at(-1)!, 10);
      return [
        200,
        {
          nbHits: 1,
          hits: [
            {
              bundle_skus: null,
              calculated_prices: { GBP: page + 10 },
              image_url: `https://cdn11.bigcommerce.com/images/${page}.jpg`,
              in_stock: true,
              name: `Partition Whisky ${page}`,
              sku: `PART-${page}`,
              url: `/whiskies/partition/partition-whisky-${page}/`,
              volume: 70,
            },
          ],
        },
      ];
    });

  await expect(scrapeMasterOfMalt({ dryRun: true })).resolves.toBe(9);
  expect(axiosMock.history.post).toHaveLength(9);
});

test("fails rather than silently truncating an oversized partition", () => {
  expect(() =>
    parseMasterOfMaltProducts({
      nbHits: 1001,
      hits: [],
    }),
  ).toThrow("price partition exceeds the complete-search limit");
});

test("fails when a configured price partition becomes empty", async ({
  axiosMock,
}) => {
  axiosMock.onPost(firstPartitionUrl).reply(200, { nbHits: 0, hits: [] });

  await expect(scrapeMasterOfMalt({ dryRun: true })).rejects.toThrow(
    "price partition unexpectedly empty",
  );
});
