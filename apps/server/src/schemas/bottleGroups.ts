import { z } from "zod";

export const BottleGroupRetiredTargetDataSchema = z
  .object({
    replacement: z
      .discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("group"),
            groupId: z.number().int().positive(),
          })
          .strict(),
        z
          .object({
            kind: z.literal("bottle"),
            bottleId: z.number().int().positive(),
          })
          .strict(),
      ])
      .nullable(),
  })
  .strict();

export type BottleGroupRetiredTargetData = z.infer<
  typeof BottleGroupRetiredTargetDataSchema
>;
