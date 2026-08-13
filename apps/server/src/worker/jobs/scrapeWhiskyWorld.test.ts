import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeWhiskyWorld, { scrapeProducts } from "./scrapeWhiskyWorld";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl =
  "https://www.thewhiskyworld.com/whisky-c7/70cl-t24?show=48&page=1";
const secondPageUrl =
  "https://www.thewhiskyworld.com/whisky-c7/70cl-t24?show=48&page=2";

test("routes The Whisky World source to its scraper job", () => {
  expect(getJobForSite("whiskyworld")).toBe("ScrapeWhiskyWorld");
});

test("scrapes directly buyable bottles and excludes ineligible cards", async ({
  axiosMock,
}) => {
  const result = await loadFixture("whiskyworld", "bottle-list.html");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl:
        "https://www.thewhiskyworld.com/images/hazelwood-legacy-collection-p13670_thumb.jpg",
      name: "A Breath Of Fresh Air - House of Hazelwood Legacy Collection",
      price: 144990,
      url: "https://www.thewhiskyworld.com/a-breath-of-fresh-air-house-of-hazelwood-legacy-collection-p13670",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.thewhiskyworld.com/images/compass-box-orchard-house-p201_thumb.jpg",
      name: "Compass Box Orchard House",
      price: 4590,
      url: "https://www.thewhiskyworld.com/compass-box-orchard-house-p201",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.thewhiskyworld.com/images/minor-case-p202_thumb.jpg",
      name: "Minor Case Sherry Cask Rye Whiskey",
      price: 4399,
      url: "https://www.thewhiskyworld.com/minor-case-sherry-cask-rye-whiskey-p202",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.thewhiskyworld.com/images/dalmore-trio-p203_thumb.jpg",
      name: "The Dalmore The Trio",
      price: 8900,
      url: "https://www.thewhiskyworld.com/the-dalmore-the-trio-p203",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.thewhiskyworld.com/images/cask-canvas-p204_thumb.jpg",
      name: "Cask & Canvas The Duo",
      price: 6000,
      url: "https://www.thewhiskyworld.com/cask-and-canvas-the-duo-p204",
      volume: 700,
    },
  ]);
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("whiskyworld", "bottle-list.html");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock.onGet(secondPageUrl).reply(200, "<main></main>");

  await expect(scrapeWhiskyWorld({ dryRun: true })).resolves.toBe(5);
  expect(axiosMock.history.get.map(({ url }: { url?: string }) => url)).toEqual(
    [firstPageUrl, secondPageUrl],
  );
});

test("fails a page that has cards but no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(
    200,
    `<main id="js-search-results-products__list">
      <div class="product" id="product_1_1">
        <div class="product__details__title">
          <a href="/unavailable-whisky-p1">Unavailable Whisky</a>
        </div>
        <a class="product__options__view"><span>View</span></a>
      </div>
    </main>`,
  );

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow(
    "Whisky World page contained product cards but no supported listings.",
  );
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(200, "<main></main>");

  await expect(scrapeWhiskyWorld({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
