import config from "@peated/server/config";
import { ApiClient } from "@peated/server/lib/apiClient";
import { logError } from "@peated/server/lib/log";
import { normalizeBottle } from "@peated/server/lib/normalize";
import {
  chunked,
  downloadFileAsBlob,
  getUrl,
} from "@peated/server/lib/scraper";
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
  const apiClient = new ApiClient({
    server: config.API_SERVER,
    accessToken: process.env.ACCESS_TOKEN,
  });

  await scrapeBottles(
    `https://api.smws.com/api/v1/bottles?store_id=uk&parent_id=61&page=1&sortBy=featured&minPrice=0&maxPrice=0&perPage=128`,
    async (bottleData, priceData, imageUrl) => {
      if (process.env.ACCESS_TOKEN) {
        console.log(`Submitting [${bottleData.name}]`);

        let bottle;
        try {
          bottle = await trpcClient.bottleUpsert.mutate({
            ...bottleData,
          });
        } catch (err) {
          if (!isTRPCClientError(err) || err.data?.httpStatus !== 409) {
            logError(err, { bottle: bottleData });
            return;
          }
        }

        if (bottle && !bottle.imageUrl && imageUrl) {
          try {
            const blob = await downloadFileAsBlob(imageUrl);
            await apiClient.post(`/bottles/${bottle.id}/image`, {
              data: {
                image: blob,
              },
            });
          } catch (err) {
            logError(err, { bottle: bottleData, price: priceData });
          }
        }

        try {
          await trpcClient.priceCreateBatch.mutate({
            site: "smws",
            prices: [priceData],
          });
        } catch (err) {
          if (!isTRPCClientError(err) || err.data?.httpStatus !== 409) {
            logError(err, { bottle: bottleData, price: priceData });
          }
        }
      } else {
        console.log(`Dry Run [${bottleData.name}]`);
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
    release_date: string; // seems to be iso
    distilleddate: string; // needs parsed
    image: string;
  }[];
};

export async function scrapeBottles(
  url: string,
  cb: (
    bottle: z.input<typeof BottleInputSchema>,
    price: z.input<typeof StorePriceInputSchema>,
    imageUrl?: string | null,
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

        const { name, statedAge, vintageYear, releaseYear } = normalizeBottle({
          name: details.name,
          statedAge: item.age,
          releaseYear: item.release_date
            ? new Date(item.release_date).getFullYear()
            : null,
          isFullName: false,
        });

        const [caskFill, caskType, caskSize] = parseCaskType(item.cask_type);
        // "2nd fill ex-bourbon hogshead"

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
            distillers: [
              {
                name: details.distiller,
              },
            ],
            flavorProfile,
            caskFill,
            caskSize,
            caskType,
            singleCask: true,
          },
          {
            name: `SMWS ${details.name}`,
            price: Math.floor(item.price * 100),
            currency: "gbp",
            volume: 750,
            url: `https://smws.com${item.url}`,
          },
          item.image,
        );
      }),
    );
  });
}
