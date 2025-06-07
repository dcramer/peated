import { z } from "zod";

export const RegionCheckConfigSchema = z.object({
  country: z.number(),
  region: z.number().nullable().default(null),
});

export type RegionCheckConfig = z.infer<typeof RegionCheckConfigSchema>;
