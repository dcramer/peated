import { logError } from "@peated/server/lib/log";
import { getUrl } from "@peated/server/lib/scraper";
import {
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
} from "@peated/server/lib/smws";
import { isTRPCClientError } from "@peated/server/lib/trpc";
import { trpcClient } from "@peated/server/lib/trpc/server";
import {
  type BottleInputSchema,
  type StorePriceInputSchema,
} from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { type z } from "zod";

export default async function scrapeSMWSA() {
  await scrapeBottles(
    `https://newmake.smwsa.com/collections/all-products`,
    async (bottle, price) => {
      if (process.env.ACCESS_TOKEN) {
        console.log(`Submitting [${bottle.name}]`);

        try {
          await trpcClient.bottleUpsert.mutate({
            ...bottle,
          });
        } catch (err) {
          if (!isTRPCClientError(err) || err.data?.httpStatus !== 409) {
            logError(err, { bottle });
            return;
          }
        }

        if (price) {
          try {
            await trpcClient.priceCreateBatch.mutate({
              site: "smwsa",
              prices: [price],
            });
          } catch (err) {
            if (!isTRPCClientError(err) || err.data?.httpStatus !== 409) {
              logError(err, { bottle, price });
            }
          }
        }
      } else {
        console.log(`Dry Run [${bottle.name}]`);
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
  cb: (
    bottle: z.infer<typeof BottleInputSchema>,
    price: z.infer<typeof StorePriceInputSchema> | null,
  ) => Promise<void>,
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

    const rawPrice = $(".product-collection-module__price", el)
      .first()
      .text()
      .trim();
    const price =
      rawPrice && rawPrice.startsWith("$")
        ? Math.floor(Number(rawPrice.substring(1)) * 100)
        : null;

    const url = $("a.product-collection-module__grid-item-gallery", el)
      .first()
      .attr("href");
    if (!url) {
      console.error(`Cannot find url: ${name}`);
      continue;
    }

    const ageSpec = specList.find(([name]) => name === "Age:");
    const statedAge = ageSpec ? Number(ageSpec[1].split(" ")[0]) : null;

    const flavorSpec = specList.find(([name]) => name === "Flavour:");
    const flavorProfile = flavorSpec ? parseFlavorProfile(flavorSpec[1]) : null;

    const caskSpec = specList.find(([name]) => name === "Cask:");
    const [caskFill, caskType, caskSize] = caskSpec
      ? parseCaskType(caskSpec[1])
      : [null, null, null];

    const details = parseDetailsFromName(`${itemType} ${caskName}`);
    if (!details?.distiller) {
      console.error(`Cannot find distiller: ${itemType}`);
      continue;
    }
    if (!details.category) {
      console.error(`Unsupported spirit: ${itemType}`);
      continue;
    }

    await cb(
      {
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
        caskFill,
        caskType,
        caskSize,
      },
      price
        ? {
            name: `SMWS ${details.name}`,
            price,
            volume: 750,
            currency: "usd",
            url,
          }
        : null,
    );
  }
}
