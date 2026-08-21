import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeReserveBar, { parseReserveBarProducts } from "./scrapeReserveBar";

const authUrl = "https://api.liquidcommerce.cloud/api/authentication";
const catalogUrl = "https://api.liquidcommerce.cloud/api/catalog/search";

test("parses supported bottles from the catalog response", async () => {
  const fixture = JSON.parse(
    await loadFixture("reservebar", "bottle-list.json"),
  );

  const result = parseReserveBarProducts(fixture);

  expect(result.hasNextPage).toBe(true);
  expect(result.products.map((item) => StorePriceInputSchema.parse(item)))
    .toMatchInlineSnapshot(`
      [
        {
          "currency": "usd",
          "externalProductId": "GROUPING-1234",
          "imageUrl": "https://assets.liquidcommerce.co/catalog/macallan.png",
          "name": "The Macallan Double Cask 12-year-old",
          "price": 9289,
          "url": "https://www.reservebar.com/products/the-macallan-double-cask-12-year-old/GROUPING-1234",
          "volume": 700,
        },
        {
          "currency": "usd",
          "externalProductId": "GROUPING-38632",
          "imageUrl": null,
          "name": "Gentleman Jack Tennessee Whiskey",
          "price": 2839,
          "url": "https://www.reservebar.com/products/gentleman-jack-tennessee-whiskey/GROUPING-38632",
          "volume": 750,
        },
      ]
    `);
});

test("continues when a page only contains unsupported products", () => {
  const result = parseReserveBarProducts({
    navigation: { currentPage: 1, totalPages: 2 },
    products: [
      {
        images: [],
        name: "Whiskey Miniature",
        priceInfo: { average: 999, currency: "USD" },
        salsifyGrouping: "GROUPING-MINI",
        sizes: [
          {
            pack: false,
            size: "50 ML",
            uom: "MILLILITRE",
            volume: "50",
          },
        ],
      },
    ],
  });

  expect(result).toEqual({ products: [], hasNextPage: true });
});

test("authenticates once and follows the catalog page count", async ({
  axiosMock,
}) => {
  const firstPage = JSON.parse(
    await loadFixture("reservebar", "bottle-list.json"),
  );
  axiosMock.onGet(authUrl).reply(200, { data: { token: "catalog-token" } });
  axiosMock
    .onPost(new RegExp(`^${catalogUrl}`))
    .reply((request: { data?: string }) => {
      const body = JSON.parse(request.data!);
      if (body.page === 1) return [200, firstPage];
      return [
        200,
        {
          navigation: { currentPage: 2, totalPages: 2 },
          products: [],
        },
      ];
    });

  await expect(scrapeReserveBar({ dryRun: true })).resolves.toBe(2);
  expect(axiosMock.history.get).toHaveLength(1);
  expect(axiosMock.history.post).toHaveLength(2);
  expect(JSON.parse(axiosMock.history.post[0].data)).toMatchObject({
    page: 1,
    perPage: 16,
    filters: [
      { key: "availability", values: "IN_STOCK" },
      { key: "categories", values: ["SPIRITS > WHISKEY"] },
    ],
  });
});
