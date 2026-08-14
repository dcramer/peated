import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeBerryBrosRudd, { scrapeProducts } from "./scrapeBerryBrosRudd";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.bbr.com/search?page=1&spirit_type=Scotch%20Whisky&own_selection=true";
const secondPageUrl =
  "https://www.bbr.com/search?page=2&spirit_type=Scotch%20Whisky&own_selection=true";

test("routes the Berry Bros. & Rudd source to its scraper job", () => {
  expect(getJobForSite("berrybrosrudd")).toBe("ScrapeBerryBrosRudd");
});

test("scrapes purchasable own-selection bottles and excludes ineligible cards", async ({
  axiosMock,
}) => {
  const result = await loadFixture("berrybrosrudd", "bottle-list.html");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  const page = scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });
  await expect(page).resolves.toEqual({ hasSourceProducts: true });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl:
        "https://media.bbr.com/s/bbr/20188403652-ms?fmt=auto&qlt=default",
      name: "2018 Berry Bros. & Rudd The Auld & The Bold Glen Wyvis, Cask Ref. 157, Highland, Single Malt Scotch Whisky (58.1%)",
      price: 8500,
      url: "https://www.bbr.com/products-20188403652-2018-berry-bros-and-rudd-glen-wyvis",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://www.bbr.com/images/benrinnes.png",
      name: "1979 Berry Bros. & Rudd Exceptional Casks, Benrinnes, Cask Ref. 62, Speyside, Single Malt Scotch Whisky (42.1%)",
      price: 180000,
      url: "https://www.bbr.com/products-19798075646-1979-berry-bros-and-rudd-benrinnes",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "Berry Bros. & Rudd Speyside Sherry Cask, 12-year-old, Single Malt Scotch Whisky (45.3%)",
      price: 4595,
      url: "https://www.bbr.com/products-speyside-sherry-cask",
      volume: 700,
    },
  ]);
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("berrybrosrudd", "bottle-list.html");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, "<main></main>");

  await expect(scrapeBerryBrosRudd({ dryRun: true })).resolves.toBe(3);
  expect(axiosMock.history.get.map(({ url }: { url?: string }) => url)).toEqual(
    [firstPageUrl, secondPageUrl],
  );
});

test("continues after a page whose products are all filtered", async ({
  axiosMock,
}) => {
  const filteredPage = `<div data-testid="product-card" class="sf-product-card">
    <span class="body--strong">Unavailable whisky</span>
    <button class="add-item">Sold out</button>
  </div>`;
  const result = await loadFixture("berrybrosrudd", "bottle-list.html");
  const thirdPageUrl =
    "https://www.bbr.com/search?page=3&spirit_type=Scotch%20Whisky&own_selection=true";
  axiosMock.onGet(firstPageUrl).reply(200, filteredPage);
  axiosMock.onGet(secondPageUrl).reply(200, result);
  axiosMock.onGet(thirdPageUrl).reply(200, "<main></main>");

  await expect(scrapeBerryBrosRudd({ dryRun: true })).resolves.toBe(3);
  expect(axiosMock.history.get).toHaveLength(3);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, "<main></main>");

  await expect(scrapeBerryBrosRudd({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
