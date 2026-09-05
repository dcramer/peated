import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Cadenhead's by default; applying keeps price IDs and leaves collection paused. */
export async function prepareCadenheadsSource(input: PreparePriceSourceInput) {
  return preparePriceSource(input, {
    siteKey: "cadenheads",
    siteName: "Cadenhead's",
    targetKey: "cadenheads",
    origin: "https://www.cadenhead.shop",
    listUrl: "https://www.cadenhead.shop/product-category/whisky/",
    isExpectedPrice: (price) =>
      /^https:\/\/www\.cadenhead\.shop\/product\/[a-z0-9][a-z0-9-]*\/$/.test(
        price.url,
      ) &&
      (price.externalProductId === null ||
        /^\d+$/.test(price.externalProductId)) &&
      price.name.trim().length > 0 &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
