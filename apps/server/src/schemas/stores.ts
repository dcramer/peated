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
  price: z.number().describe("Current price of the bottle"),
  currency: CurrencyEnum.describe("Currency of the price"),
  url: z.string().describe("URL to the product page"),
  volume: z.number().describe("Volume of the bottle in milliliters"),
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
});

export const StorePriceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Required")
    .describe("Name of the product as listed by the store"),
  price: z.number().describe("Current price of the bottle"),
  currency: CurrencyEnum.describe("Currency of the price"),
  volume: z
    .number()
    .refine((val) => ALLOWED_VOLUMES.includes(val), {
      message: `Volume must be one of: ${ALLOWED_VOLUMES.join(", ")}`,
    })
    .describe("Volume of the bottle in milliliters"),
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

export const BottlePriceChangeSchema = z.object({
  id: z.number().describe("Unique identifier for the price change"),
  price: z.number().describe("New price of the bottle"),
  previousPrice: z.number().describe("Previous price of the bottle"),
  currency: CurrencyEnum.describe("Currency of the prices"),
  bottle: BottleSchema.nullable().describe("The bottle whose price changed"),
});
