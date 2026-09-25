import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeWoodenCork";

test("simple", async ({ axiosMock }) => {
  const url = "https://woodencork.com/collections/whiskey?page=2";
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
      "externalProductId": "4395720474760",
      "name": "Elmer T. Lee Single Barrel Bourbon",
      "price": 33899,
      "url": "https://woodencork.com/collections/whiskey/products/elmer-t-lee-bourbon",
      "volume": 750,
    }
  `);
});

test("supports the current collection card markup", async ({ axiosMock }) => {
  const url = "https://woodencork.com/collections/whiskey?page=1";
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

function card(title: string, handle: string) {
  return `<div class="product-grid-item">
    <div class="grid-product__title">${title}</div>
    <a class="grid-item__link" href="products/${handle}"></a>
    <span class="grid-product__price--current">
      <span class="visually-hidden">$42.00</span>
    </span>
  </div>`;
}

test("reads spaced sizes and skips sizes outside the allowed list", async ({
  axiosMock,
}) => {
  const url = "https://woodencork.com/collections/whiskey?page=1";
  axiosMock.onGet(url).reply(
    200,
    `<div class="collection-grid">
      ${card("Jack Daniel's Tennessee Whiskey 3L", "jack-daniels-3l")}
      ${card("Laphroaig Quarter Cask 750 ml", "laphroaig-quarter-cask")}
      ${card("Lagavulin 16 Year - 750 mL", "lagavulin-16")}
      ${card("Knob Creek Old Fashioned 375 ml", "knob-creek-old-fashioned")}
    </div>`,
  );

  const items: any[] = [];
  await scrapeProducts(url, async (item) => {
    items.push(item);
  });

  expect(items.map((item) => [item.name, item.volume])).toEqual([
    ["Laphroaig Quarter Cask", 750],
    ["Lagavulin 16-year-old", 750],
  ]);
});
