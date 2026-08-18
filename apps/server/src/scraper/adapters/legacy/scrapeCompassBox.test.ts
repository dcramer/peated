import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeCompassBox, {
  parseCompassBoxProducts,
  scrapeProducts,
} from "./scrapeCompassBox";

process.env.DISABLE_HTTP_CACHE = "1";

const shopUrl = "https://www.compassboxwhisky.com/collections";

test("scrapes regular and sale prices and excludes sold-out bottles", async ({
  axiosMock,
}) => {
  const result = await loadFixture("compassbox", "bottle-list.html");
  axiosMock.onGet(shopUrl).reply(200, result);

  const items: unknown[] = [];
  await scrapeProducts(shopUrl, async (item) => {
    items.push(StorePriceInputSchema.parse(item));
  });

  expect(items).toEqual([
    {
      currency: "gbp",
      imageUrl:
        "https://www.compassboxwhisky.com/cdn/shop/files/OrchardHouse.png?v=1722005482&width=533",
      name: "Compass Box Orchard House",
      price: 4500,
      url: "https://www.compassboxwhisky.com/products/orchard-house",
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl:
        "https://www.compassboxwhisky.com/cdn/shop/files/BruleeRoyale.png?width=533",
      name: "Compass Box Brûlée Royale",
      price: 9995,
      url: "https://www.compassboxwhisky.com/products/brulee-royale-1",
      volume: 700,
    },
  ]);
});

test("rejects malformed available product cards", () => {
  const html = `
    <div class="card-wrapper product-card-wrapper">
      <h3 class="card__heading"><a href="/products/broken">Broken</a></h3>
      <div class="card__media"><img src="/broken.png"></div>
    </div>
  `;

  expect(() => parseCompassBoxProducts(html, shopUrl)).toThrow();
});

test("runs a single-page dry run and stops on duplicate listings", async ({
  axiosMock,
}) => {
  const result = await loadFixture("compassbox", "bottle-list.html");
  axiosMock.onGet(shopUrl).reply(200, result);

  await expect(scrapeCompassBox({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(2);
});

test("fails when a complete scrape yields no supported listings", async ({
  axiosMock,
}) => {
  axiosMock.onGet(shopUrl).reply(200, "<main></main>");

  await expect(scrapeCompassBox({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
