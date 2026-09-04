import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Compass Box by default; applying keeps price IDs and leaves collection paused. */
export async function prepareCompassBoxSource(input: PreparePriceSourceInput) {
  return preparePriceSource(input, {
    siteKey: "compassbox",
    siteName: "Compass Box",
    targetKey: "compassbox",
    origin: "https://www.compassboxwhisky.com",
    listUrl: "https://www.compassboxwhisky.com/collections",
    isExpectedPrice: (price) =>
      /^https:\/\/www\.compassboxwhisky\.com\/products\/[a-z0-9][a-z0-9-]*$/.test(
        price.url,
      ) &&
      price.externalProductId === null &&
      price.name.startsWith("Compass Box ") &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
