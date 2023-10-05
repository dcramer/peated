import { z } from "zod";
import { BottleSchema } from "./bottles";
import { UserSchema } from "./users";

export const FlightSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Required"),
  description: z.string().nullable(),
  public: z.boolean(),
  createdAt: z.string().datetime().optional(),
  createdBy: UserSchema.optional(),
});

export const FlightInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  public: z.boolean().default(false).optional(),
  bottles: z.array(z.number()).optional(),
});

export const FlightBottleSchema = z.object({
  bottle: BottleSchema,
});

export const FlightBottleInputSchema = z.object({
  bottle: z.number(),
});
