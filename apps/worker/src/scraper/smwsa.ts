import { CATEGORY_LIST } from "@peated/server/constants";
import { type BottleInputSchema } from "@peated/server/schemas";
import { type Category } from "@peated/server/types";
import { getUrl } from "@peated/worker/scraper";
import { load as cheerio } from "cheerio";
import { type z } from "zod";
import { SMWS_DISTILLERY_CODES } from "../constants";
import { trpcClient } from "../lib/api";

export default async function main() {
  await scrapeBottles(
    `https://newmake.smwsa.com/collections/all-products`,
    async (item) => {
      if (process.env.ACCESS_TOKEN) {
        console.log(`Submitting [${item.name}]`);

        try {
          await trpcClient.bottleCreate.mutate({
            ...item,
          });
        } catch (err) {
          console.error(err);
        }
      } else {
        console.log(`Dry Run [${item.name}]`);
      }
    },
  );

  // if (process.env.ACCESS_TOKEN) {
  //   await trpcClient.externalSiteUpdate.mutate({
  //     site: "smwsa",
  //     key: "processedIssues",
  //     value: processedIssues,
  //   });
  // }
}

export async function scrapeBottles(
  url: string,
  cb: (bottle: z.infer<typeof BottleInputSchema>) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  $(".product-collection-module__grid-item").each((_, el) => {
    const itemType = $(".product-collection-module__type", el)
      .first()
      .text()
      .trim();
    if (!itemType || !itemType.startsWith("Cask No.")) {
      return;
    }

    const caskName = $(".product-collection-module__title", el)
      .first()
      .text()
      .trim();

    const specList: [string, string][] = [];
    $(".product-collection-module__specs-list li", el).each((_, specEl) => {
      const name = $(
        ".product-collection-module__specs-item-col--title",
        specEl,
      )
        .first()
        .text()
        .trim();
      const value = $(
        ".product-collection-module__specs-item-col--desc",
        specEl,
      )
        .first()
        .text()
        .trim();
      specList.push([name, value]);
    });

    const ageSpec = specList.find(([name]) => name === "Age:");
    const statedAge = ageSpec ? Number(ageSpec[1].split(" ")[0]) : null;

    const caskNumberMatch = itemType.match(/Cask No\. ([A-Z0-9]+\.[0-9]+)/i);
    if (!caskNumberMatch) {
      throw new Error(`Cannot find cask number: ${itemType}`);
    }
    const caskNumber = caskNumberMatch[1];

    const distillerMatch = caskNumber.match(/([A-Z0-9]+)\.[0-9]+/i);
    if (!distillerMatch) {
      throw new Error(`Cannot find distiller: ${itemType}`);
    }
    const distillerNo = distillerMatch[1];
    if (!distillerNo) {
      throw new Error(`Cannot find distiller: ${itemType}`);
    }

    const rawCategory = getCategoryFromCask(caskNumber);
    if (rawCategory && !CATEGORY_LIST.includes(rawCategory as any)) {
      throw new Error(`Unsupporteed spirit: ${rawCategory}`);
    }

    const category = rawCategory as Category;

    cb({
      name: `${caskNumber} ${caskName}`,
      category,
      statedAge,
      brand: {
        name: "The Scotch Malt Whisky Society",
      },
      distillers: SMWS_DISTILLERY_CODES[distillerNo]
        ? [
            {
              name: SMWS_DISTILLERY_CODES[distillerNo],
            },
          ]
        : [],
    });
  });
}

function getCategoryFromCask(caskNumber: string) {
  if (caskNumber.startsWith("GN")) {
    return "gin";
  } else if (caskNumber.startsWith("RW")) {
    return "rye";
  } else if (caskNumber.startsWith("CW1")) {
    // corn - where should it go?
    return null;
  } else if (caskNumber.startsWith("B")) {
    return "bourbon";
  } else if (caskNumber.startsWith("R")) {
    return "rum";
  } else if (caskNumber.startsWith("A")) {
    return "armagnac";
  } else if (caskNumber.startsWith("C")) {
    return "cognac";
  } else if (caskNumber.startsWith("G")) {
    return "single_grain";
  } else if (Number(caskNumber[0]) > 0) {
    return "single_malt";
  } else {
    return null;
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
