import { z } from "zod";

export const CountrySchema = z.object({
  name: z.string().trim().min(1, "Required"),
  slug: z.string().trim().min(1, "Required"),
});
