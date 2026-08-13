import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeDouglasLaing, { scrapeProducts } from "./scrapeDouglasLaing";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.douglaslaing.com/en-us/collections/scotch-whisky/products.json?limit=250&page=1";

test("routes the Douglas Laing source to its scraper job", () => {
  expect(getJobForSite("douglaslaing")).toBe("ScrapeDouglasLaing");
});

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
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/big-peat-football.png",
      name: "Big Peat The World Football Edition 2026",
      price: 6500,
      url: "https://www.douglaslaing.com/en-us/products/big-peat-the-world-football-edition-2026",
      volume: 700,
    },
    {
      currency: "usd",
      imageUrl: "https://cdn.shopify.com/s/files/rangers-girvan.png",
      name: "Rangers Girvan 17-year-old",
      price: 8750,
      url: "https://www.douglaslaing.com/en-us/products/rangers-girvan-17-years-old",
      volume: 500,
    },
    {
      currency: "usd",
      imageUrl: null,
      name: "XOP North British 35-year-old",
      price: 42500,
      url: "https://www.douglaslaing.com/en-us/products/xop-north-british-35-years-old",
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
  const result = await loadFixture("douglaslaing", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet(
      "https://www.douglaslaing.com/en-us/collections/scotch-whisky/products.json?limit=250&page=2",
    )
    .reply(200, { products: [] });

  await expect(scrapeDouglasLaing({ dryRun: true })).resolves.toBeUndefined();
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeDouglasLaing({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
