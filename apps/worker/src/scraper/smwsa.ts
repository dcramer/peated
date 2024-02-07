import { type BottleInputSchema } from "@peated/server/schemas";
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
    const statedAge = ageSpec ? Number(ageSpec[1]) : null;

    const category = "single_malt";

    const distillerMatch = itemType.match(/Cask No\. ([A-Z0-9]+)\.[0-9]+/i);
    if (!distillerMatch) {
      throw new Error(`Cannot find distiller: ${itemType}`);
    }
    const distillerNo = distillerMatch[1];
    if (!distillerNo) {
      throw new Error(`Cannot find distiller: ${itemType}`);
    }

    cb({
      name: `${itemType} ${caskName}`,
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

if (typeof require !== "undefined" && require.main === module) {
  main();
}
