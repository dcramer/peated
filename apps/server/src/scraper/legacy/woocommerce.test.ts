import { describe, expect, test, vi } from "vitest";
import {
  decodeWooCommerceText,
  parseWooCommercePrice,
  scrapeWooCommerceProducts,
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
