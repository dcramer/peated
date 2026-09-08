import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks GlenAllachie by default; applying keeps price IDs and leaves collection paused. */
export async function prepareGlenAllachieSource(
  input: PreparePriceSourceInput,
) {
  return preparePriceSource(input, {
    siteKey: "glenallachie",
    siteName: "GlenAllachie",
    targetKey: "glenallachie",
    origin: "https://shop.theglenallachie.com",
    listUrl: "https://shop.theglenallachie.com/collections/all-products",
    isExpectedPrice: (price) =>
      /^https:\/\/shop\.theglenallachie\.com\/products\/[a-z0-9][a-z0-9-]*$/.test(
        price.url,
      ) &&
      /^\d+$/.test(price.externalProductId ?? "") &&
      /^(?:The GlenAllachie|Meikle Tòir|White Heather|MacNair's)\b/.test(
        price.name,
      ) &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
