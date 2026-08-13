import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeBruichladdich, { scrapeProducts } from "./scrapeBruichladdich";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.bruichladdich.com/collections/all/products.json?country=GB&limit=250&page=1";
const secondPageUrl =
  "https://www.bruichladdich.com/collections/all/products.json?country=GB&limit=250&page=2";

test("routes the Bruichladdich source to its scraper job", () => {
  expect(getJobForSite("bruichladdich")).toBe("ScrapeBruichladdich");
});

test("scrapes available full-size whisky and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("bruichladdich", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/bruichladdich-bere-barley.png",
      name: "Bruichladdich Bere Barley 2013",
      price: 10000,
      url: "https://www.bruichladdich.com/products/bruichladdich-bere-barley-2013",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/port-charlotte-10.png",
      name: "Port Charlotte 10",
      price: 6000,
      url: "https://www.bruichladdich.com/products/port-charlotte-10",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.bruichladdich.com/cdn/shop/files/octomore-16-1.png",
      name: "Octomore Edition 16.1",
      price: 14000,
      url: "https://www.bruichladdich.com/products/octomore-16-1",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/biodynamic-project.png",
      name: "Bruichladdich The Biodynamic Project",
      price: 10000,
      url: "https://www.bruichladdich.com/products/the-biodynamic-project",
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
  const result = await loadFixture("bruichladdich", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, { products: [] });

  await expect(scrapeBruichladdich({ dryRun: true })).resolves.toBe(4);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("continues after a page whose products are all filtered", async ({
  axiosMock,
}) => {
  const result: { products: Array<{ title?: unknown }> } = JSON.parse(
    await loadFixture("bruichladdich", "bottle-list.json"),
  );
  const filteredProduct = result.products.find(
    (product) => product.title === "The Botanist Islay Dry Gin",
  );
  expect(filteredProduct).toBeDefined();

  axiosMock.onGet(firstPageUrl).reply(200, {
    products: [filteredProduct],
  });
  axiosMock.onGet(secondPageUrl).reply(200, result);
  axiosMock
    .onGet(
      "https://www.bruichladdich.com/collections/all/products.json?country=GB&limit=250&page=3",
    )
    .reply(200, { products: [] });

  await expect(scrapeBruichladdich({ dryRun: true })).resolves.toBe(4);
  expect(axiosMock.history.get).toHaveLength(3);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeBruichladdich({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
