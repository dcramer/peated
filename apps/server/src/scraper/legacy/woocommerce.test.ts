import { describe, expect, test, vi } from "vitest";
import {
  decodeWooCommerceText,
  getWooCommerceStorePriceIdentity,
  parseWooCommercePrice,
  scrapeWooCommerceProducts,
  WooCommerceProductSchema,
} from "./woocommerce";

process.env.DISABLE_HTTP_CACHE = "1";

describe("parseWooCommercePrice", () => {
  test.each([
    ["1", 1],
    ["5833", 5833],
    ["0", null],
    ["1.00", null],
    ["£100", null],
  ])("parses %s", (value, expected) => {
    expect(parseWooCommercePrice(value)).toBe(expected);
  });
});

test("decodes product text", () => {
  expect(decodeWooCommerceText("Cadenhead&#8217;s &amp; Co.")).toBe(
    "Cadenhead’s & Co.",
  );
});

test("reports source products when every listing is filtered", async ({
  axiosMock,
}) => {
  const url = "https://shop.example.com/wp-json/wc/store/v1/products?page=1";
  axiosMock.onGet(url).reply(200, [{ name: "Gift set" }]);
  const callback = vi.fn();

  const result = await scrapeWooCommerceProducts(url, callback, () => []);

  expect(result).toEqual({ hasSourceProducts: true });
  expect(callback).not.toHaveBeenCalled();
});

test("rejects malformed catalog payloads", async ({ axiosMock }) => {
  const url = "https://shop.example.com/wp-json/wc/store/v1/products?page=1";
  axiosMock.onGet(url).reply(200, { products: [] });

  await expect(
    scrapeWooCommerceProducts(
      url,
      async () => {},
      () => [],
    ),
  ).rejects.toThrow();
});

function productWithIdentity(input: { id?: number; gtin?: string | null }) {
  return WooCommerceProductSchema.parse({
    ...input,
    name: "Example Whisky",
    permalink: "https://example.com/example-whisky",
    prices: {
      price: "5000",
      currency_code: "GBP",
      currency_minor_unit: 2,
    },
    images: [],
    is_in_stock: true,
    is_purchasable: true,
  });
}

test("returns the stable product id and a valid GTIN", () => {
  expect(
    getWooCommerceStorePriceIdentity(
      productWithIdentity({ id: 123, gtin: "036602301979" }),
    ),
  ).toEqual({
    barcode: "036602301979",
    externalProductId: "123",
  });
});

test("omits unsupported identity claims", () => {
  expect(
    getWooCommerceStorePriceIdentity(
      productWithIdentity({ gtin: "not-a-gtin" }),
    ),
  ).toEqual({});
});
