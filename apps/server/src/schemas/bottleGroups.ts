import { BOTTLE_ALIAS_ASSIGNMENT_SOURCES } from "@peated/server/db/schema";
import { z } from "zod";

export const BottleGroupAliasAssignmentSourceSchema = z.enum(
  BOTTLE_ALIAS_ASSIGNMENT_SOURCES,
);

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

/** Stable public alias projection for a BottleGroup's generic target. */
export const BottleGroupAliasV1Schema = z.object({
  name: z.string().min(1),
  assignmentSource: BottleGroupAliasAssignmentSourceSchema,
  createdAt: z.string().datetime(),
});

export type BottleGroupAliasV1 = z.infer<typeof BottleGroupAliasV1Schema>;
export type BottleGroupRetiredTargetData = z.infer<
  typeof BottleGroupRetiredTargetDataSchema
>;
