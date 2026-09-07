import { ALLOWED_VOLUMES } from "@peated/server/constants";
import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Edradour by default; applying keeps price IDs and leaves collection paused. */
export async function prepareEdradourSource(input: PreparePriceSourceInput) {
  return preparePriceSource(input, {
    siteKey: "edradour",
    siteName: "Edradour",
    targetKey: "edradour",
    origin: "https://www.edradour.com",
    listUrl: "https://www.edradour.com/shop/",
    isExpectedPrice: (price) =>
      /^https:\/\/www\.edradour\.com\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
        price.url,
      ) &&
      price.externalProductId === null &&
      /^(?:Edradour|Ballechin)\b/.test(price.name) &&
      price.currency === "gbp" &&
      ALLOWED_VOLUMES.includes(price.volume),
  });
}
