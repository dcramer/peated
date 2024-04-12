import { getUrl } from "@peated/server/lib/scraper";
import {
  parseDetailsFromName,
  parseFlavorProfile,
} from "@peated/server/lib/smws";
import { trpcClient } from "@peated/server/lib/trpc/server";
import { type BottleInputSchema } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { type z } from "zod";

export default async function scrapeSMWSA() {
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

  for (const el of $(".product-collection-module__grid-item")) {
    const itemType = $(".product-collection-module__type", el)
      .first()
      .text()
      .trim();
    if (!itemType || !itemType.startsWith("Cask No.")) {
      continue;
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

    const flavorSpec = specList.find(([name]) => name === "Flavour:");
    const flavorProfile = flavorSpec ? parseFlavorProfile(flavorSpec[1]) : null;

    const details = parseDetailsFromName(`${itemType} ${caskName}`);
    if (!details?.distiller) {
      console.error(`Cannot find distiller: ${itemType}`);
      continue;
    }
    if (!details.category) {
      console.error(`Unsupported spirit: ${itemType}`);
      continue;
    }

    await cb({
      name: details.name,
      category: details.category,
      statedAge,
      brand: {
        name: "The Scotch Malt Whisky Society",
      },
      bottler: {
        name: "The Scotch Malt Whisky Society",
      },
      distillers: [{ name: details.distiller }],
      flavorProfile,
    });
  }
}
