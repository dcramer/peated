import { ALLOWED_VOLUMES } from "@peated/server/constants";
import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Thompson Bros by default; applying keeps price IDs and leaves collection paused. */
export async function prepareThompsonBrosSource(
  input: PreparePriceSourceInput,
) {
  return preparePriceSource(input, {
    siteKey: "thompsonbros",
    siteName: "Thompson Bros.",
    targetKey: "thompsonbros",
    origin: "https://www.thompsonbrosdistillers.com",
    listUrl: "https://www.thompsonbrosdistillers.com/product-category/whisky/",
    isExpectedPrice: (price) =>
      /^https:\/\/www\.thompsonbrosdistillers\.com\/product\/[a-z0-9][a-z0-9-]*\/$/.test(
        price.url,
      ) &&
      (price.externalProductId === null ||
        /^\d+$/.test(price.externalProductId)) &&
      price.name.startsWith("Thompson Bros ") &&
      price.currency === "gbp" &&
      ALLOWED_VOLUMES.includes(price.volume),
  });
}
