import { z } from "zod";
import { EntityTypeEnum } from "./common";

const PositiveIdSchema = z.number().int().positive();

export const MergeEntitiesDispatchExecutionResultSchema = z
  .object({
    type: z.literal("merge_entities"),
    status: z.literal("applying"),
    operationId: PositiveIdSchema,
    sourceEntityId: PositiveIdSchema,
    destinationEntityId: PositiveIdSchema,
    approvingModeratorId: PositiveIdSchema,
  })
  .strict();

export const BottleOperationExecutionResultSchema = z.discriminatedUnion(
  "type",
  [
    z
      .object({
        type: z.literal("update_bottle"),
        status: z.literal("applied"),
        bottleId: PositiveIdSchema,
        groupId: PositiveIdSchema,
        changed: z.boolean(),
      })
      .strict(),
    z
      .object({
        type: z.literal("merge_bottles"),
        status: z.literal("applied"),
        sourceBottleId: PositiveIdSchema,
        destinationBottleId: PositiveIdSchema,
        changed: z.boolean(),
      })
      .strict(),
    z
      .object({
        type: z.literal("update_entity"),
        status: z.literal("applied"),
        entityId: PositiveIdSchema,
        changed: z.boolean(),
      })
      .strict(),
    MergeEntitiesDispatchExecutionResultSchema,
  ],
);

export const EntityMergeOperationExecutionResultSchema = z
  .object({
    type: z.literal("merge_entities"),
    sourceEntityId: PositiveIdSchema,
    destinationEntityId: PositiveIdSchema,
    destinationRoles: z.array(EntityTypeEnum),
    approvingModeratorId: PositiveIdSchema,
    reconciled: z.boolean(),
    execution: z
      .object({
        kind: z.literal("worker"),
        name: z.literal("MergeEntity"),
      })
      .strict(),
  })
  .strict();

export const PersistedBottleOperationExecutionResultSchema = z.union([
  BottleOperationExecutionResultSchema,
  EntityMergeOperationExecutionResultSchema,
]);

export type BottleOperationExecutionResult = z.infer<
  typeof BottleOperationExecutionResultSchema
>;
export type MergeEntitiesDispatchExecutionResult = z.infer<
  typeof MergeEntitiesDispatchExecutionResultSchema
>;
export type EntityMergeOperationExecutionResult = z.infer<
  typeof EntityMergeOperationExecutionResultSchema
>;
export type PersistedBottleOperationExecutionResult = z.infer<
  typeof PersistedBottleOperationExecutionResultSchema
>;
