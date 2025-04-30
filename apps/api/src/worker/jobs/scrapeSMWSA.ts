import { normalizeBottle } from "@peated/server/lib/normalize";
import { getUrl, handleBottle } from "@peated/server/lib/scraper";
import {
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
} from "@peated/server/lib/smws";
import {
  type BottleInputSchema,
  type StorePriceInputSchema,
} from "@peated/server/schemas";

import { load as cheerio } from "cheerio";
import { type z } from "zod";

export default async function scrapeSMWSA() {
  await scrapeBottles(
    `https://newmake.smwsa.com/collections/all-products`,
    handleBottle,
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
    bottle: z.input<typeof BottleInputSchema>,
    price?: z.input<typeof StorePriceInputSchema> | null,
    imageUrl?: string | null,
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
      console.error(`Cannot find url: ${caskName}`);
      continue;
    }

    const ageSpec = specList.find(([name]) => name === "Age:");
    let statedAge = ageSpec ? Number(ageSpec[1].split(" ")[0]) : null;

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

    let name = details.name;
    let vintageYear, releaseYear;

    ({ name, statedAge, vintageYear, releaseYear } = normalizeBottle({
      name,
      statedAge,
      isFullName: false,
    }));

    const imageUrl =
      $("img.product-collection-module__grid-item-image", el)
        .first()
        .attr("src") ?? null;

    await cb(
      {
        name,
        vintageYear,
        releaseYear,
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
        singleCask: true,
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
      imageUrl,
    );
  }
}
