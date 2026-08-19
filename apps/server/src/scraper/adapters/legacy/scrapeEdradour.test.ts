import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeEdradour, { scrapeProducts } from "./scrapeEdradour";

process.env.DISABLE_HTTP_CACHE = "1";

const firstPageUrl = "https://www.edradour.com/shop/?p=1";
const secondPageUrl = "https://www.edradour.com/shop/?p=2";
const detailUrls = {
  ballechin: "https://www.edradour.com/ballechin-10-year-old",
  generic: "https://www.edradour.com/cask-strength-21-year-old-oloroso-sherry",
  merchandise: "https://www.edradour.com/baseball-cap",
  liqueur: "https://www.edradour.com/cream-liqueur",
  sample: "https://www.edradour.com/whisky-sample",
  malformed: "https://www.edradour.com/malformed-release",
} as const;

async function mockFirstPage(axiosMock: {
  onGet: (url: string) => { reply: (status: number, body: string) => unknown };
}) {
  const fixtures = await Promise.all([
    loadFixture("edradour", "bottle-list.html"),
    loadFixture("edradour", "ballechin-detail.html"),
    loadFixture("edradour", "generic-detail.html"),
    loadFixture("edradour", "merchandise-detail.html"),
    loadFixture("edradour", "liqueur-detail.html"),
    loadFixture("edradour", "sample-detail.html"),
    loadFixture("edradour", "malformed-detail.html"),
  ]);

  axiosMock.onGet(firstPageUrl).reply(200, fixtures[0]);
  axiosMock.onGet(detailUrls.ballechin).reply(200, fixtures[1]);
  axiosMock.onGet(detailUrls.generic).reply(200, fixtures[2]);
  axiosMock.onGet(detailUrls.merchandise).reply(200, fixtures[3]);
  axiosMock.onGet(detailUrls.liqueur).reply(200, fixtures[4]);
  axiosMock.onGet(detailUrls.sample).reply(200, fixtures[5]);
  axiosMock.onGet(detailUrls.malformed).reply(200, fixtures[6]);
}

test("scrapes purchasable whisky and excludes unsupported products", async ({
  axiosMock,
}) => {
  await mockFirstPage(axiosMock);

  const items: unknown[] = [];
  const page = scrapeProducts(firstPageUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });
  await expect(page).resolves.toEqual({ hasSourceProducts: true });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl: "https://www.edradour.com/media/ballechin-10.jpg",
      name: "Ballechin 10-year-old",
      price: 4876,
      url: detailUrls.ballechin,
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: "https://www.edradour.com/media/cask-strength-21.jpg",
      name: "Edradour Cask Strength 21-year-old Oloroso Sherry",
      price: 37500,
      url: detailUrls.generic,
      volume: 700,
    },
  ]);
  expect(
    axiosMock.history.get.map((request: { url?: string }) => request.url),
  ).not.toContain("https://www.edradour.com/caledonia-12-year-old");
  expect(
    axiosMock.history.get.map((request: { url?: string }) => request.url),
  ).not.toContain("https://example.com/external-release");
});

test("paginates a dry run and stops after an empty storefront page", async ({
  axiosMock,
}) => {
  await mockFirstPage(axiosMock);
  axiosMock
    .onGet(secondPageUrl)
    .reply(200, '<div class="cms-listing-row"></div>');

  await expect(scrapeEdradour({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(8);
  expect(axiosMock.history.get.at(-1)?.url).toBe(secondPageUrl);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock
    .onGet(firstPageUrl)
    .reply(200, '<div class="cms-listing-row"></div>');

  await expect(scrapeEdradour({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
