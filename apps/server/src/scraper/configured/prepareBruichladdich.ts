import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Bruichladdich by default; applying keeps price IDs and leaves collection paused. */
export async function prepareBruichladdichSource(
  input: PreparePriceSourceInput,
) {
  return preparePriceSource(input, {
    siteKey: "bruichladdich",
    siteName: "Bruichladdich",
    targetKey: "bruichladdich",
    origin: "https://www.bruichladdich.com",
    listUrl:
      "https://www.bruichladdich.com/collections/all?filter.v.availability=1",
    isExpectedPrice: (price) =>
      /^https:\/\/www\.bruichladdich\.com\/products\/[a-z0-9][a-z0-9-]*$/.test(
        price.url,
      ) &&
      /^\d+$/.test(price.externalProductId ?? "") &&
      price.name.trim().length > 0 &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
