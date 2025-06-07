import { z } from "zod";

export const BottleCheckConfigSchema = z.object({
  bottle: z.array(z.number()).min(1, "At least one bottle is required."),
});

export type BottleCheckConfig = z.infer<typeof BottleCheckConfigSchema>;
