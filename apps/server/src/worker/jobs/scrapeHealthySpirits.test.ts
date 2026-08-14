import { loadFixture } from "@peated/server/lib/test/fixtures";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { getJobForSite } from "@peated/server/worker/utils";
import scrapeHealthySpirits, {
  parseHealthySpiritsProducts,
} from "./scrapeHealthySpirits";

const catalogUrl =
  "https://us-vir5-storefront-api.ecwid.com/storefront/api/v1/115311147/catalog";

test("routes the Healthy Spirits source to its scraper job", () => {
  expect(getJobForSite("healthyspirits")).toBe("ScrapeHealthySpirits");
});

test("parses in-stock bottles from the catalog response", async () => {
  const fixture = JSON.parse(
    await loadFixture("healthyspirits", "bottle-list.json"),
  );

  const result = parseHealthySpiritsProducts(fixture, 0);

  expect(result.hasNextPage).toBe(true);
  expect(result.products.map((item) => StorePriceInputSchema.parse(item)))
    .toMatchInlineSnapshot(`
      [
        {
          "currency": "usd",
          "imageUrl": "https://d2j6dbq0eux0bg.cloudfront.net/images/bushmills.jpg",
          "name": "Bushmills Black Bush",
          "price": 3999,
          "url": "https://www.healthyspirits.com/products/bushmills-black-bush-750ml",
          "volume": 750,
        },
        {
          "currency": "usd",
          "imageUrl": null,
          "name": "Fuji Japanese Whisky Blend",
          "price": 7999,
          "url": "https://www.healthyspirits.com/products/fuji-japanese-whisky-blend-700ml",
          "volume": 700,
        },
      ]
    `);
});

test("continues when a page only contains unsupported products", () => {
  const result = parseHealthySpiritsProducts(
    {
      expandedCategories: [
        {
          categoryInfo: { id: 179389817 },
          products: [
            {
              defaultOptionsOverrides: {
                pricesOverrides: { basePrice: 9.99 },
                variationOverrides: { isSoldOut: false },
              },
              name: "WHISKEY MINIATURE 50ML",
              seo: {
                canonicalUrl:
                  "https://www.healthyspirits.com/products/whiskey-miniature-50ml",
              },
            },
          ],
          totalProductsCount: 61,
        },
      ],
    },
    0,
  );

  expect(result).toEqual({ products: [], hasNextPage: true });
});

test("follows the catalog total without persisting a dry run", async ({
  axiosMock,
}) => {
  const firstPage = JSON.parse(
    await loadFixture("healthyspirits", "bottle-list.json"),
  );
  const lastProduct = {
    ...firstPage.expandedCategories[0].products[0],
    name: "FOUR ROSES BOURBON 750ML",
    seo: {
      canonicalUrl:
        "https://www.healthyspirits.com/products/four-roses-bourbon-750ml",
    },
  };

  axiosMock
    .onPost(new RegExp(`^${catalogUrl}`))
    .reply((request: { data?: string }) => {
      const body = JSON.parse(request.data!);
      if (body.pagination.offset === 0) return [200, firstPage];
      return [
        200,
        {
          expandedCategories: [
            {
              categoryInfo: { id: 179389817 },
              products: [lastProduct],
              totalProductsCount: 61,
            },
          ],
        },
      ];
    });

  await expect(scrapeHealthySpirits({ dryRun: true })).resolves.toBe(3);
  expect(axiosMock.history.post).toHaveLength(2);
  expect(JSON.parse(axiosMock.history.post[0].data)).toMatchObject({
    parentCategoryId: 179389817,
    pagination: { offset: 0, limit: 60 },
  });
  expect(JSON.parse(axiosMock.history.post[1].data)).toMatchObject({
    pagination: { offset: 60, limit: 60 },
  });
});
