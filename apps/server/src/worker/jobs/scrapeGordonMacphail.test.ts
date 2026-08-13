import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeGordonMacphail, { scrapeProducts } from "./scrapeGordonMacphail";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://shop.gordonandmacphail.com/products.json?limit=250&page=1";

test("routes the Gordon & MacPhail source to its scraper job", () => {
  expect(getJobForSite("gordonmacphail")).toBe("ScrapeGordonMacphail");
});

test("scrapes available bottles and excludes unsupported products", async ({
  axiosMock,
}) => {
  const result = await loadFixture("gordonmacphail", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl:
        "https://cdn.shopify.com/s/files/1/1914/4899/products/G_M_DistilleryLabels_Linkwood15YearsOld_46__70cl.jpg",
      name: "Distillery Labels Linkwood 15-year-old 46%",
      price: 9000,
      url: "https://shop.gordonandmacphail.com/products/distillery-labels-linkwood-15-years-old-46",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "CC CASK STRENGTH GLENTURRET 2007 59.8% - 70cl",
      price: 16000,
      url: "https://shop.gordonandmacphail.com/products/cc-cask-strength-glenturret-2007-59-8-70cl",
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
  const result = await loadFixture("gordonmacphail", "bottle-list.json");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet("https://shop.gordonandmacphail.com/products.json?limit=250&page=2")
    .reply(200, { products: [] });

  await expect(scrapeGordonMacphail({ dryRun: true })).resolves.toBe(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, { products: [] });

  await expect(scrapeGordonMacphail({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
