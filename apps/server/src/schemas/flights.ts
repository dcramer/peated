import { z } from "zod";
import { CatalogTargetV1Schema } from "./catalogIdentity";
import { EntitySchema } from "./entities";
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

export const FlightTargetSchema = z.object({
  target: CatalogTargetV1Schema.describe(
    "Exact Bottle or generic BottleGroup identity",
  ),
  distillers: z
    .array(EntitySchema)
    .describe("Distillers owned by the target's exact Bottle or BottleGroup"),
  hasTasted: z
    .boolean()
    .describe("Whether the current user has tasted this target in the flight"),
  isLibrary: z
    .boolean()
    .describe("Whether the current user has this target in their Library"),
});

export const FlightDetailsSchema = FlightSchema.extend({
  targets: z
    .array(FlightTargetSchema)
    .describe("Ordered catalog targets and flight-specific viewer state"),
});

export const FlightInputSchema = z.object({
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
    .array(z.number())
    .optional()
    .describe("Array of bottle IDs to include in the flight"),
});
