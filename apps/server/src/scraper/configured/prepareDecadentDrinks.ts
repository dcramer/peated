import { ALLOWED_VOLUMES } from "@peated/server/constants";
import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Decadent Drinks by default; applying keeps price IDs and leaves collection paused. */
export async function prepareDecadentDrinksSource(
  input: PreparePriceSourceInput,
) {
  return preparePriceSource(input, {
    siteKey: "decadentdrinks",
    siteName: "Decadent Drinks",
    targetKey: "decadentdrinks",
    origin: "https://decadent-drinks.com",
    listUrl: "https://decadent-drinks.com/shop/category/whisky",
    isExpectedPrice: (price) =>
      /^https:\/\/decadent-drinks\.com\/shop\/[a-z0-9][a-z0-9-]*\/?$/i.test(
        price.url,
      ) &&
      price.externalProductId === null &&
      price.name.trim().length > 0 &&
      price.currency === "gbp" &&
      ALLOWED_VOLUMES.includes(price.volume),
  });
}
