import { z } from "zod";
import { BottleSchema } from "./bottles";
import { UserSchema } from "./users";

export const FlightSchema = z.object({
  id: z.string().describe("Unique identifier for the flight"),
  name: z.string().trim().min(1, "Required").describe("Name of the flight"),
  description: z.string().nullable().describe("Description of the flight"),
  public: z.boolean().describe("Whether the flight is publicly visible"),
  createdAt: z
    .string()
    .datetime()
    .optional()
    .describe("Timestamp when the flight was created"),
  createdBy: UserSchema.optional().describe("User who created this flight"),
});

export const FlightBottleSchema = z.object({
  bottle: BottleSchema.describe("Bottle included in the flight"),
  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this Bottle in the flight"),
  isLibrary: z
    .boolean()
    .describe("Whether the current user has this Bottle in their Library"),
});

export const FlightDetailsSchema = FlightSchema.extend({
  bottles: z
    .array(FlightBottleSchema)
    .describe("Ordered Bottles and flight-specific viewer state"),
});

export const FlightInputFields = {
  name: z.string().trim().min(1, "Required").describe("Name of the flight"),
  description: z
    .string()
    .nullable()
    .optional()
    .describe("Description of the flight"),
  public: z
    .boolean()
    .default(false)
    .optional()
    .describe("Whether the flight is publicly visible"),
  bottles: z
    .array(z.number().int().positive())
    .optional()
    .describe("Bottle IDs to include in the flight"),
} as const;

export const FlightInputSchema = z.object(FlightInputFields).strict();
