import { z } from "zod";
import { PointSchema } from "./shared";

export const CountrySchema = z.object({
  name: z.string().trim().min(1, "Required"),
  slug: z.string().trim().min(1, "Required"),
  location: PointSchema.nullable().optional(),
  totalBottles: z.number(),
  totalDistillers: z.number(),
});
