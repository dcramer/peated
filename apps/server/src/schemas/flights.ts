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

export const FlightBottleSchema = z.object({
  bottle: BottleSchema.describe("The bottle in this flight"),
});

export const FlightBottleInputSchema = z.object({
  bottle: z.number().describe("ID of the bottle to add to the flight"),
});
