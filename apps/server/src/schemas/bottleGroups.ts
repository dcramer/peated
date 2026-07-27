import { z } from "zod";

export const BottleGroupReplacementDataSchema = z
  .object({
    replacementGroupId: z.number().int().positive(),
  })
  .strict();

export type BottleGroupReplacementData = z.infer<
  typeof BottleGroupReplacementDataSchema
>;
