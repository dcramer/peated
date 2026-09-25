import { expect, test, vi } from "vitest";
import { scrapeShopifyProducts } from "./shopify";

process.env.DISABLE_HTTP_CACHE = "1";

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
