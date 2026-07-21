import { z } from "zod";
import { ALLOWED_VOLUMES } from "../constants";
import { CatalogTargetV1Schema } from "./catalogIdentity";
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
  target: CatalogTargetV1Schema.nullable().describe(
    "Authoritative catalog identity for this listing, when resolved",
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
  id: z.number().describe("Catalog target identifier for the price change"),
  price: z.number().describe("New average price for the catalog target"),
  previousPrice: z
    .number()
    .describe("Previous average price for the catalog target"),
  currency: CurrencyEnum.describe("Currency of the catalog target prices"),
  target: CatalogTargetV1Schema.describe(
    "Authoritative exact Bottle or generic BottleGroup whose price changed",
  ),
  isLibrary: z
    .boolean()
    .describe("Whether the current user has this target in their Library"),
  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this target"),
});
