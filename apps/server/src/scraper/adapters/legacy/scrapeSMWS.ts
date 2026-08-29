import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
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

  const numericValue = z.number().safeParse(value);
  if (numericValue.success) return numericValue.data;

  // Remove % symbol and trim whitespace
  const cleanValue = z.string().parse(value).replace("%", "").trim();

  // Convert to float
  const floatValue = parseFloat(cleanValue);

  // Return null if the conversion failed
  return isNaN(floatValue) ? null : floatValue;
}

function parseVintageYear(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = /^(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{4})$/u.exec(
    value.trim(),
  );
  if (!match?.groups) return null;

  const day = Number(match.groups.day);
  const month = Number(match.groups.month);
  const year = Number(match.groups.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? year
    : null;
}

function parseReleaseDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = value.trim().slice(0, 10);
  return z.string().date().safeParse(date).success ? date : null;
}

function parseVolume(sku: string): number | null {
  // SMWS UK SKUs encode the bottle size in centilitres after GB or GX.
  const match = /(?:GB|GX)(?<centilitres>\d{3})/u.exec(sku);
  if (!match?.groups) return null;

  const volume = Number(match.groups.centilitres) * 10;
  return ALLOWED_VOLUMES.includes(volume) ? volume : null;
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
      // `stock` is remaining inventory, not producer-stated outturn.
      id: z.number().int().positive(),
      sku: z.string(),
      name: z.string(),
      age: z.number().nullish(),
      abv: z.union([z.string(), z.number()]).nullish(),
      cask_no: z.string().nullish(),
      cask_type: z.string().nullish(),
      distilleddate: z.string().nullish(),
      list_description: z.string().nullish(),
      price: z.number(),
      sale_price: z.number().nullish(),
      url: z.string(),
      release_date: z.string().nullish(),
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

        const releaseDate = parseReleaseDate(item.release_date);

        const { name, statedAge, vintageYear, releaseYear } = normalizeBottle({
          name: details.name,
          statedAge: item.age,
          vintageYear: parseVintageYear(item.distilleddate),
          releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
          isFullName: false,
        });

        const abv = parseAbv(item.abv);
        const volume = parseVolume(item.sku);
        if (!volume) {
          logScrapeWarning(SITE, "Cannot find supported bottle volume", {
            caskNumber,
            sku: item.sku,
          });
        }

        await cb(
          {
            name,
            vintageYear,
            releaseYear,
            releaseDate,
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
            maturation: item.cask_type?.trim() || null,
            caskNumber,
            singleCask: true,
            description: item.list_description?.trim() || null,
          },
          volume
            ? {
                name: `SMWS ${details.name}`,
                price: Math.round(
                  (item.sale_price && item.sale_price > 0
                    ? item.sale_price
                    : item.price) * 100,
                ),
                currency: "gbp",
                volume,
                url: `https://smws.com${item.url}`,
                externalProductId: String(item.id),
              }
            : null,
          item.image,
        );
        itemCount += 1;
      }),
    );
  });
  return itemCount;
}
