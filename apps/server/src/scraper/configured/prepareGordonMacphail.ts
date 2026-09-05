import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Gordon & MacPhail by default; applying keeps price IDs and leaves collection paused. */
export async function prepareGordonMacphailSource(
  input: PreparePriceSourceInput,
) {
  return preparePriceSource(input, {
    siteKey: "gordonmacphail",
    siteName: "Gordon & MacPhail",
    targetKey: "gordonmacphail",
    origin: "https://shop.gordonandmacphail.com",
    listUrl: "https://shop.gordonandmacphail.com/collections/all",
    isExpectedPrice: (price) =>
      /^https:\/\/shop\.gordonandmacphail\.com\/products\/[a-z0-9][a-z0-9-]*$/.test(
        price.url,
      ) &&
      /^\d+$/.test(price.externalProductId ?? "") &&
      price.name.trim().length > 0 &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
