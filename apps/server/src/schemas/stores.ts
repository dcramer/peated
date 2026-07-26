import { z } from "zod";
import { ALLOWED_VOLUMES } from "../constants";
import { BottleSchema } from "./bottles";
import { CurrencyEnum } from "./common";
import { ExternalSiteSchema } from "./externalSites";

// TODO: lets rename price to value in all of these, and update
// the schema accordingly
export const StorePriceSchema = z.object({
  id: z.number().describe("Unique identifier for the store price"),
  name: z.string().describe("Name of the product as listed by the store"),
  price: z.number().describe("Current price of the listing"),
  currency: CurrencyEnum.describe("Currency of the price"),
  url: z.string().describe("URL to the product page"),
  volume: z.number().describe("Listed volume in milliliters"),
  site: ExternalSiteSchema.optional().describe(
    "External site where this price is listed",
  ),
  updatedAt: z
    .string()
    .datetime()
    .describe("Timestamp when the price was last updated"),
  imageUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .default(null)
    .readonly()
    .describe("URL to the product image"),
  isValid: z
    .boolean()
    .readonly()
    .describe("Whether this price listing is still valid"),
  bottle: BottleSchema.nullable().describe(
    "Bottle associated with this listing, or null when unresolved",
  ),
});

export const StorePriceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Name of the product as listed by the store"),
  price: z.number().describe("Current price of the listing"),
  currency: CurrencyEnum.describe("Currency of the price"),
  volume: z
    .number()
    .refine((val) => ALLOWED_VOLUMES.includes(val), {
      message: `Volume must be one of: ${ALLOWED_VOLUMES.join(", ")}`,
    })
    .describe("Listed volume in milliliters"),
  url: z
    .string()
    .trim()
    .url()
    .min(1, "Required")
    .describe("URL to the product page"),
  imageUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .default(null)
    .optional()
    .describe("Optional URL to the product image"),
});

export const PriceChangeSchema = z.object({
  id: z.number().describe("Bottle identifier for the price change"),
  price: z.number().describe("New average price for the Bottle"),
  previousPrice: z.number().describe("Previous average price for the Bottle"),
  currency: CurrencyEnum.describe("Currency of the Bottle prices"),
  bottle: BottleSchema.describe("Bottle whose price changed"),
  isLibrary: z
    .boolean()
    .describe("Whether the current user has this Bottle in their Library"),
  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this Bottle"),
});
