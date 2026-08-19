import { describe, expect, test, vi } from "vitest";
import {
  getShopifyImageUrl,
  parseShopifyPrice,
  scrapeShopifyProducts,
} from "./shopify";

process.env.DISABLE_HTTP_CACHE = "1";

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

test("reports source products when every listing is filtered", async ({
  axiosMock,
}) => {
  const url = "https://shop.example.com/products.json?page=1";
  axiosMock.onGet(url).reply(200, { products: [{ title: "Gift set" }] });
  const callback = vi.fn();

  const result = await scrapeShopifyProducts(url, callback, () => []);

  expect(result).toEqual({ hasSourceProducts: true });
  expect(callback).not.toHaveBeenCalled();
});

test("rejects malformed catalog payloads", async ({ axiosMock }) => {
  const url = "https://shop.example.com/products.json?page=1";
  axiosMock.onGet(url).reply(200, { items: [] });

  await expect(
    scrapeShopifyProducts(
      url,
      async () => {},
      () => [],
    ),
  ).rejects.toThrow();
});
