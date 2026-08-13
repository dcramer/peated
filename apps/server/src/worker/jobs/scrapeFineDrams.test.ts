import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeFineDrams, { scrapeProducts } from "./scrapeFineDrams";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl = "https://www.finedrams.com/whisky?in-stock=1&p=1";
const secondPageUrl = "https://www.finedrams.com/whisky?in-stock=1&p=2";

test("routes Fine Drams to its scraper job", () => {
  expect(getJobForSite("finedrams")).toBe("ScrapeFineDrams");
});

test("scrapes in-stock single bottles and excludes ineligible cards", async ({
  axiosMock,
}) => {
  const result = await loadFixture("finedrams", "bottle-list.html");
  axiosMock.onGet(firstPageUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "eur",
      imageUrl: "https://d1wd5rt8ssn8ry.cloudfront.net/image/lagavulin.webp",
      name: "Lagavulin 12-year-old (2019 Special Release)",
      price: 12880,
      url: "https://www.finedrams.com/lagavulin-12-year-old-cask-strength-2019-special-release-whisky.html",
      volume: 700,
    },
    {
      currency: "eur",
      imageUrl:
        "https://d1wd5rt8ssn8ry.cloudfront.net/image/johnnie-walker.webp",
      name: "Johnnie Walker Island Green (1 Liter)",
      price: 6320,
      url: "https://www.finedrams.com/johnnie-walker-island-green-whisky-1-liter.html",
      volume: 1000,
    },
    {
      currency: "eur",
      imageUrl: "https://d1wd5rt8ssn8ry.cloudfront.net/image/eagle-rare.jpg",
      name: "Eagle Rare 10-year-old",
      price: 104400,
      url: "https://www.finedrams.com/eagle-rare-10-year-old-whiskey.html",
      volume: 700,
    },
  ]);
});

test("paginates a dry run and stops after an empty page", async ({
  axiosMock,
}) => {
  const result = await loadFixture("finedrams", "bottle-list.html");
  axiosMock.onGet(firstPageUrl).reply(200, result);
  axiosMock
    .onGet(secondPageUrl)
    .reply(
      200,
      '<div id="product_list_ajax"><ul class="product_list grid"></ul></div>',
    );

  await expect(scrapeFineDrams({ dryRun: true })).resolves.toBe(3);
  expect(axiosMock.history.get.map(({ url }: { url?: string }) => url)).toEqual(
    [firstPageUrl, secondPageUrl],
  );
});

test("fails a page that has cards but no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(firstPageUrl).reply(
    200,
    `<div id="product_list_ajax"><ul class="product_list grid"><li>
      <a class="product" href="/miniature.html">
        <div class="details">
          <h5 class="name">Whisky Miniature</h5>
          <span class="name_extra">5 cl, 40%</span>
          <div class="quantity success">In stock</div>
          <div class="price">5.00 €</div>
        </div>
      </a>
    </li></ul></div>`,
  );

  await expect(scrapeProducts(firstPageUrl, async () => {})).rejects.toThrow(
    "Fine Drams page contained product cards but no supported listings.",
  );
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock
    .onGet(firstPageUrl)
    .reply(
      200,
      '<div id="product_list_ajax"><ul class="product_list grid"></ul></div>',
    );

  await expect(scrapeFineDrams({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
