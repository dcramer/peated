import { StorePriceInputSchema } from "@peated/server/schemas";
import scrapeDramfool, {
  parseDramfoolProductLinks,
  parseDramfoolProductPage,
} from "./scrapeDramfool";

process.env.DISABLE_HTTP_CACHE = "1";

const shopUrl = "https://dramfool.com/shop";
const firstProductUrl = `${shopUrl}/glenallachie-11`;
const secondProductUrl = `${shopUrl}/rhinns-13`;

const shopHtml = `
  <div class="ProductList-item post-type-store-item">
    <a class="ProductList-item-link" href="/shop/glenallachie-11"></a>
  </div>
  <div class="ProductList-item post-type-store-item">
    <a class="ProductList-item-link" href="/shop/rhinns-13"></a>
  </div>
  <div class="ProductList-item post-type-store-item">
    <a class="ProductList-item-link" href="https://other.example/product"></a>
  </div>
`;

function productHtml({
  title,
  variants,
  itemId,
  imageUrl,
  productType = 1,
  availability,
}: {
  title: string;
  variants: unknown[];
  itemId?: string;
  imageUrl?: string;
  productType?: number;
  availability?: string;
}) {
  return `
    ${availability ? `<meta property="product:availability" content="${availability}">` : ""}
    <article class="ProductItem"${itemId ? ` data-item-id="${itemId}"` : ""}>
      <h1 class="ProductItem-details-title">${title}</h1>
      ${imageUrl ? `<img class="ProductItem-gallery-slides-item-image" data-src="${imageUrl}">` : ""}
      <div class="product-variants" data-variants='${JSON.stringify(variants)}'></div>
      <div class="sqs-add-to-cart-button" data-product-type="${productType}"></div>
    </article>
  `;
}

const firstProductHtml = productHtml({
  title: "Dramfool Glenallachie 11",
  itemId: "product-id",
  imageUrl: "https://images.squarespace-cdn.com/glenallachie-11.png",
  variants: [
    {
      id: "6baddfdf-bfb4-4355-bb4d-c98bb7132588",
      barcode: "036602301979",
      attributes: { Size: "70cl" },
      priceMoney: { currency: "GBP", value: "100.00" },
      onSale: false,
      unlimited: false,
      qtyInStock: 248,
    },
    {
      attributes: { Size: "5cl" },
      priceMoney: { currency: "GBP", value: "10.00" },
      onSale: false,
      unlimited: false,
      qtyInStock: 8,
    },
    {
      attributes: { Size: "70cl" },
      priceMoney: { currency: "GBP", value: "80.00" },
      onSale: false,
      unlimited: false,
      qtyInStock: 0,
    },
  ],
});

const secondProductHtml = productHtml({
  title: "Rhinns 2011, 13 year old cask #R11/281-1",
  variants: [
    {
      attributes: { size: "0.7 L" },
      priceMoney: { currency: "GBP", value: "162.50" },
      salePriceMoney: { currency: "GBP", value: "150.00" },
      onSale: true,
      unlimited: true,
      qtyInStock: 0,
    },
  ],
});

test("finds unique official product pages", () => {
  expect(parseDramfoolProductLinks(shopHtml)).toEqual([
    firstProductUrl,
    secondProductUrl,
  ]);
});

test("reads purchasable full-bottle variants from product HTML", () => {
  const products = [
    ...parseDramfoolProductPage(firstProductHtml, firstProductUrl),
    ...parseDramfoolProductPage(secondProductHtml, secondProductUrl),
  ].map((product) => StorePriceInputSchema.parse(product));

  expect(products).toEqual([
    {
      barcode: "036602301979",
      currency: "gbp",
      externalProductId: "6baddfdf-bfb4-4355-bb4d-c98bb7132588",
      imageUrl: "https://images.squarespace-cdn.com/glenallachie-11.png",
      name: "Dramfool Glenallachie 11",
      price: 10000,
      url: firstProductUrl,
      volume: 700,
    },
    {
      currency: "gbp",
      imageUrl: null,
      name: "Dramfool Rhinns 2011, 13-year-old cask #R11/281-1",
      price: 15000,
      url: secondProductUrl,
      volume: 700,
    },
  ]);
});

test("uses variant stock when page availability says out of stock", () => {
  const html = productHtml({
    title: "Dramfool Glenallachie 11",
    availability: "outofstock",
    variants: [
      {
        attributes: { Size: "70cl" },
        priceMoney: { currency: "GBP", value: "100.00" },
        onSale: false,
        unlimited: false,
        qtyInStock: 1,
      },
    ],
  });

  expect(parseDramfoolProductPage(html, firstProductUrl)).toHaveLength(1);
});

test("ignores non-physical products", () => {
  const html = productHtml({
    title: "Dramfool Tasting Ticket",
    productType: 2,
    variants: [],
  });

  expect(parseDramfoolProductPage(html, `${shopUrl}/tasting-ticket`)).toEqual(
    [],
  );
});

test("uses the allowed shop and product pages once", async ({ axiosMock }) => {
  axiosMock.onGet(shopUrl).reply(200, shopHtml);
  axiosMock.onGet(firstProductUrl).reply(200, firstProductHtml);
  axiosMock.onGet(secondProductUrl).reply(200, secondProductHtml);

  await expect(scrapeDramfool({ dryRun: true })).resolves.toBe(2);
  expect(
    axiosMock.history.get.map((request: { url?: string }) => request.url),
  ).toEqual([shopUrl, firstProductUrl, secondProductUrl]);
});

test("fails when the shop has no supported products", async ({ axiosMock }) => {
  axiosMock.onGet(shopUrl).reply(200, '<div class="ProductList-grid"></div>');

  await expect(scrapeDramfool({ dryRun: true })).rejects.toThrow(
    "Failed to scrape any products.",
  );
});
