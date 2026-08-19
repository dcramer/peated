import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeGlenAllachie, { scrapeProducts } from "./scrapeGlenAllachie";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://shop.theglenallachie.com/collections/all-products/products.json?country=GB&limit=250&page=1";
const secondPageUrl =
  "https://shop.theglenallachie.com/collections/all-products/products.json?country=GB&limit=250&page=2";

test("scrapes available full-size whisky and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("glenallachie", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/glenallachie-12.png",
      name: "The GlenAllachie 12-year-old",
      price: 5499,
      url: "https://shop.theglenallachie.com/products/the-glenallachie-12-year-old",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/meikle-toir-exclusive.png",
      name: "Meikle Tòir Online-Exclusive 3.0 2021 Chinquapin Virgin Oak Barrel #2300",
      price: 6999,
      url: "https://shop.theglenallachie.com/products/online-exclusive-3-0-chinquapin-virgin-oak",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://cdn.shopify.com/s/files/white-heather-15.png",
      name: "White Heather 15-year-old",
      price: 4900,
      url: "https://shop.theglenallachie.com/products/white-heather-15-year-old",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://shop.theglenallachie.com/cdn/shop/files/lum-reek-10.png",
      name: "MacNair's Lum Reek 10-year-old Cask Strength",
      price: 6250,
      url: "https://shop.theglenallachie.com/products/macnairs-lum-reek-10-year-old-cask-strength",
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
  const result = await loadFixture("glenallachie", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, { products: [] });

  await expect(scrapeGlenAllachie({ dryRun: true })).resolves.toBe(4);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeGlenAllachie({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
