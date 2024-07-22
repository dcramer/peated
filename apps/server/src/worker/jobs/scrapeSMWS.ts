import { logError } from "@peated/server/lib/log";
import { normalizeBottleName } from "@peated/server/lib/normalize";
import { chunked, getUrl } from "@peated/server/lib/scraper";
import {
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
} from "@peated/server/lib/smws";
import { trpcClient } from "@peated/server/lib/trpc/server";
import {
  type BottleInputSchema,
  type StorePriceInputSchema,
} from "@peated/server/schemas";
import { isTRPCClientError } from "@peated/server/trpc/client";

import { type z } from "zod";

export default async function scrapeSMWS() {
  await scrapeBottles(
    `https://api.smws.com/api/v1/bottles?store_id=uk&parent_id=61&page=1&sortBy=featured&minPrice=0&maxPrice=0&perPage=128`,
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

        try {
          await trpcClient.priceCreateBatch.mutate({
            site: "smws",
            prices: [price],
          });
        } catch (err) {
          if (!isTRPCClientError(err) || err.data?.httpStatus !== 409) {
            logError(err, { bottle, price });
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

type SMWSPayload = {
  items: {
    name: string;
    age: number | null;
    cask_no: string;
    cask_type: string;
    categories: string[];
    price: number;
    url: string;
  }[];
};

export async function scrapeBottles(
  url: string,
  cb: (
    bottle: z.infer<typeof BottleInputSchema>,
    price: z.infer<typeof StorePriceInputSchema>,
  ) => Promise<void>,
) {
  const body = await getUrl(url);
  const data = JSON.parse(body) as SMWSPayload;

  await chunked(data.items, 10, async (items) => {
    await Promise.all(
      items.map(async (item) => {
        const caskName = item.name;
        if (!caskName) {
          console.warn(`Cannot find cask name for product`);
          return;
        }
        const details = parseDetailsFromName(`${item.cask_no} ${caskName}`);
        if (!details?.distiller) {
          console.error(`Cannot find distiller: ${item.cask_no} ${caskName}`);
          return;
        }
        if (!details?.category) {
          console.error(`Unsupported spirit: ${item.cask_no} ${caskName}`);
          return;
        }

        const flavorProfileRaw = item.categories.find((c) => {
          return c.startsWith("All Whisky/Flavour Profiles/");
        });
        const flavorProfile = flavorProfileRaw
          ? parseFlavorProfile(
              flavorProfileRaw.split(
                "All Whisky/Flavour Profiles/",
              )[1] as unknown as string,
            )
          : null;

        const { name, statedAge, vintageYear, releaseYear } =
          normalizeBottleName({
            name: details.name,
            statedAge: item.age,
            isFullName: false,
          });

        const [caskFill, caskType, caskSize] = parseCaskType(item.cask_type);
        // "2nd fill ex-bourbon hogshead"

        await cb(
          {
            name: `${name}${vintageYear ? ` (${vintageYear}) Vintage)` : ""}${releaseYear ? ` (${releaseYear}) Release)` : ""}`,
            category: details.category,
            statedAge,
            brand: {
              name: "The Scotch Malt Whisky Society",
            },
            bottler: {
              name: "The Scotch Malt Whisky Society",
            },
            distillers: [
              {
                name: details.distiller,
              },
            ],
            flavorProfile,
            caskFill,
            caskSize,
            caskType,
          },
          {
            name: `SMWS ${details.name}`,
            price: Math.floor(item.price * 100),
            currency: "gbp",
            volume: 750,
            url: `https://smws.com${item.url}`,
          },
        );
      }),
    );
  });
}
