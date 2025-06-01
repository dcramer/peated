import { normalizeBottle } from "@peated/server/lib/normalize";
import { chunked, getUrl, handleBottle } from "@peated/server/lib/scraper";
import {
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
} from "@peated/server/lib/smws";
import type {
  BottleInputSchema,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import type { z } from "zod";

function parseAbv(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  // If it's already a number, return it
  if (typeof value === "number") return value;

  // Remove % symbol and trim whitespace
  const cleanValue = value.replace("%", "").trim();

  // Convert to float
  const floatValue = Number.parseFloat(cleanValue);

  // Return null if the conversion failed
  return Number.isNaN(floatValue) ? null : floatValue;
}

export default async function scrapeSMWS() {
  await scrapeBottles(
    "https://api.smws.com/api/v1/bottles?store_id=uk&parent_id=61&page=1&sortBy=featured&minPrice=0&maxPrice=0&perPage=128",
    handleBottle
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
    abv: number | null;
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
    price?: z.input<typeof StorePriceInputSchema> | null,
    imageUrl?: string | null
  ) => Promise<void>
) {
  const body = await getUrl(url);
  const data = JSON.parse(body) as SMWSPayload;

  await chunked(data.items, 10, async (items) => {
    await Promise.all(
      items.map(async (item) => {
        const caskName = item.name;
        if (!caskName) {
          console.warn("Cannot find cask name for product");
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
                "All Whisky/Flavour Profiles/"
              )[1] as unknown as string
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

        const abv = parseAbv(item.abv);

        const [caskFill, caskType, caskSize] = parseCaskType(item.cask_type);
        // "2nd fill ex-bourbon hogshead"

        await cb(
          {
            name,
            vintageYear,
            releaseYear,
            category: details.category,
            statedAge,
            abv,
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
          item.image
        );
      })
    );
  });
}
