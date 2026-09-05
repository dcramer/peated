import { ALLOWED_VOLUMES } from "@peated/server/constants";
import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks North Star by default; applying keeps price IDs and leaves collection paused. */
export async function prepareNorthStarSource(input: PreparePriceSourceInput) {
  return preparePriceSource(input, {
    siteKey: "northstarspirits",
    siteName: "North Star",
    targetKey: "northstarspirits",
    origin: "https://northstarspirits.com",
    listUrl: "https://northstarspirits.com/collections/shop",
    isExpectedPrice: (price) =>
      /^https:\/\/northstarspirits\.com\/products\/[a-z0-9][a-z0-9-]*$/.test(
        price.url,
      ) &&
      /^\d+$/.test(price.externalProductId ?? "") &&
      price.name.trim().length > 0 &&
      price.currency === "gbp" &&
      ALLOWED_VOLUMES.includes(price.volume),
  });
}
