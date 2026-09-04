import {
  preparePriceSource,
  type PreparePriceSourceInput,
} from "./preparePriceSource";

/** Checks Kilchoman by default; applying keeps price IDs and leaves collection paused. */
export async function prepareKilchomanSource(input: PreparePriceSourceInput) {
  return preparePriceSource(input, {
    siteKey: "kilchoman",
    siteName: "Kilchoman",
    targetKey: "kilchoman",
    origin: "https://www.kilchomandistillery.com",
    listUrl: "https://www.kilchomandistillery.com/whisky-shop/",
    isExpectedPrice: (price) =>
      /^https:\/\/www\.kilchomandistillery\.com\/our-whisky\/[a-z0-9][a-z0-9-]*\/$/.test(
        price.url,
      ) &&
      price.externalProductId === null &&
      price.name.startsWith("Kilchoman ") &&
      price.currency === "gbp" &&
      price.volume === 700,
  });
}
