import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Nc'nean by default; applying keeps price IDs and leaves collection paused. */
export async function prepareNcneanSource(input: PreparePriceSourceInput) {
  return preparePriceSource(input, {
    siteKey: "ncnean",
    siteName: "Nc'nean",
    targetKey: "ncnean",
    origin: "https://ncnean.com",
    listUrl: "https://ncnean.com/collections/all/whiskies",
    isExpectedPrice: (price) =>
      /^https:\/\/ncnean\.com\/products\/[a-z0-9][a-z0-9-]*$/.test(price.url) &&
      (price.externalProductId === null ||
        /^\d+$/.test(price.externalProductId)) &&
      /^Nc['’]nean\b/i.test(price.name.trim()) &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
