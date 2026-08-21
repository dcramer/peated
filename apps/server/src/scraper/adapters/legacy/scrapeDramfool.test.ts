import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeDramfool, { scrapeProducts } from "./scrapeDramfool";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl = "https://dramfool.com/shop?format=json&page=1";

test("scrapes in-stock full bottles and excludes unsupported variants", async ({
  axiosMock,
}) => {
  const result = await loadFixture("dramfool", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      barcode: "036602301979",
      currency: "gbp",
      externalProductId: "6baddfdf-bfb4-4355-bb4d-c98bb7132588",
      imageUrl: "https://images.squarespace-cdn.com/glenallachie-11.png",
      name: "Dramfool Glenallachie 11",
      price: 10000,
      url: "https://dramfool.com/shop/glenallachie-11",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "Dramfool Rhinns 2011, 13-year-old cask #R11/281-1",
      price: 15000,
      url: "https://dramfool.com/shop/rhinns-13",
      volume: 700,
    },
  ]);
});

test("rejects malformed catalog payloads", async ({ axiosMock }) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow();
});

test("processes the single catalog response and stops pagination", async ({
  axiosMock,
}) => {
  const result = await loadFixture("dramfool", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  await expect(scrapeDramfool({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(1);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { items: [] });

  await expect(scrapeDramfool({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
