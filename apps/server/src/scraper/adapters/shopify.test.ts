import { describe, expect, test } from "vitest";
import {
  getShopifyImageUrl,
  getShopifyStorePriceIdentity,
  parseShopifyPrice,
  ShopifyProductSchema,
} from "./shopify";

describe("parseShopifyPrice", () => {
  test.each([
    ["1", 100],
    ["1.2", 120],
    ["1.23", 123],
    ["0", null],
    ["1.234", null],
    ["£1.23", null],
  ])("parses %s", (value, expected) => {
    expect(parseShopifyPrice(value)).toBe(expected);
  });
});

describe("getShopifyImageUrl", () => {
  test("allows Shopify CDN and the storefront", () => {
    expect(
      getShopifyImageUrl({ src: "https://cdn.shopify.com/files/bottle.png" }, [
        "shop.example.com",
      ]),
    ).toBe("https://cdn.shopify.com/files/bottle.png");
    expect(
      getShopifyImageUrl({ src: "https://shop.example.com/cdn/bottle.png" }, [
        "shop.example.com",
      ]),
    ).toBe("https://shop.example.com/cdn/bottle.png");
  });

  test("rejects other image hosts", () => {
    expect(
      getShopifyImageUrl({ src: "https://images.example.com/bottle.png" }, [
        "shop.example.com",
      ]),
    ).toBeNull();
  });
});

test("returns the stable product id and a valid variant barcode", () => {
  const product = ShopifyProductSchema.parse({
    id: 123,
    title: "Example Whisky",
    handle: "example-whisky",
    images: [],
    variants: [
      {
        available: true,
        barcode: "036602301979",
        price: "50.00",
      },
    ],
  });

  expect(getShopifyStorePriceIdentity(product, product.variants[0]!)).toEqual({
    barcode: "036602301979",
    externalProductId: "123",
  });
});

test("omits unsupported identity claims", () => {
  const product = ShopifyProductSchema.parse({
    title: "Example Whisky",
    handle: "example-whisky",
    images: [],
    variants: [
      {
        available: true,
        barcode: "not-a-gtin",
        price: "50.00",
      },
    ],
  });

  expect(getShopifyStorePriceIdentity(product, product.variants[0]!)).toEqual(
    {},
  );
});
