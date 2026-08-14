import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeWoodenCork";

test("simple", async ({ axiosMock }) => {
  const url = "https://woodencork.com/collections/whiskey?cursor=2";
  const result = await loadFixture("woodencork", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const page = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  await expect(page).resolves.toEqual({ hasNextPage: true });

  expect(items.length).toBe(38);
  expect(items[0]).toMatchInlineSnapshot(`
    {
      "currency": "usd",
      "name": "Elmer T. Lee Single Barrel Bourbon",
      "price": 33899,
      "url": "https://woodencork.com/collections/whiskey/products/elmer-t-lee-bourbon",
      "volume": 750,
    }
  `);
});

test("supports the current collection card markup", async ({ axiosMock }) => {
  const url = "https://woodencork.com/collections/whiskey?cursor=1";
  axiosMock.onGet(url).reply(
    200,
    `<div class="collection-grid">
      <div class="product-grid-item">
        <div class="grid-product__title">New Product 700ml</div>
        <a class="grid-item__link" href="products/new-product"></a>
        <span class="grid-product__price--current">
          <span class="visually-hidden">$42.00</span>
        </span>
      </div>
    </div>`,
  );

  const items: any[] = [];
  await expect(
    scrapeProducts(url, async (item) => {
      items.push(item);
    }),
  ).resolves.toEqual({ hasNextPage: false });

  expect(items).toEqual([
    {
      name: "New Product",
      price: 4200,
      currency: "usd",
      volume: 700,
      url: "https://woodencork.com/products/new-product",
    },
  ]);
});
