import { z } from "zod";

export const AgeCheckConfigSchema = z.object({
  minAge: z.number().min(0).max(100),
  maxAge: z.number().min(0).max(100),
});

export type AgeCheckConfig = z.infer<typeof AgeCheckConfigSchema>;
