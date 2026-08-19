import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import {
  parseCaskType,
  parseDetailsFromName,
  parseFlavorProfile,
} from "@peated/bottle-classifier/smws";
import {
  type BottleInputSchema,
  type StorePriceInputSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { chunked, getUrl, handleBottle } from "../../legacy/scraper";
import { logScrapeWarning } from "./scrapeLogging";

const SITE = "smws";

function parseAbv(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  // If it's already a number, return it
  if (typeof value === "number") return value;

  // Remove % symbol and trim whitespace
  const cleanValue = value.replace("%", "").trim();

  // Convert to float
  const floatValue = parseFloat(cleanValue);

  // Return null if the conversion failed
  return isNaN(floatValue) ? null : floatValue;
}

export default async function scrapeSMWS() {
  return scrapeBottles(
    `https://api.smws.com/api/v1/bottles?store_id=uk&parent_id=61&page=1&sortBy=featured&minPrice=0&maxPrice=0&perPage=128`,
    handleBottle,
  );
}

const SMWSPayloadSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string(),
      age: z.number().nullable(),
      abv: z.union([z.string(), z.number()]).nullable(),
      cask_no: z.string().nullish(),
      cask_type: z.string().nullish(),
      categories: z.array(z.string()),
      price: z.number(),
      url: z.string(),
      release_date: z.string().nullable(),
      image: z.string(),
    }),
  ),
});

export async function scrapeBottles(
  url: string,
  cb: (
    bottle: z.input<typeof BottleInputSchema>,
    price?: z.input<typeof StorePriceInputSchema> | null,
    imageUrl?: string | null,
  ) => Promise<void>,
) {
  const body = await getUrl(url);
  const data = SMWSPayloadSchema.parse(JSON.parse(body));
  let itemCount = 0;

  await chunked(data.items, 10, async (items) => {
    await Promise.all(
      items.map(async (item) => {
        const caskName = item.name;
        if (!caskName) {
          logScrapeWarning(SITE, "Cannot find cask name for product");
          return;
        }
        const caskNumber = item.cask_no;
        if (!caskNumber) {
          logScrapeWarning(SITE, "Cannot find cask number for product", {
            caskName,
          });
          return;
        }

        const details = parseDetailsFromName(`${caskNumber} ${caskName}`);
        if (!details?.distiller) {
          logScrapeWarning(SITE, "Cannot find distiller", {
            caskNumber,
            caskName,
          });
          return;
        }
        if (!details?.category) {
          logScrapeWarning(SITE, "Unsupported spirit", {
            caskNumber,
            caskName,
          });
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

        const abv = parseAbv(item.abv);

        const [caskFill, caskType, caskSize] = item.cask_type
          ? parseCaskType(item.cask_type)
          : [null, null, null];
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
            externalProductId: String(item.id),
          },
          item.image,
        );
        itemCount += 1;
      }),
    );
  });
  return itemCount;
}
