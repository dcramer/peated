import { pushJob } from "@peated/server/worker/client";
import { z } from "zod";

const PositiveIdSchema = z.number().int().positive();

export const LegacyEntityMergeJobInputSchema = z
  .object({
    toEntityId: PositiveIdSchema,
    fromEntityIds: z.array(PositiveIdSchema).nonempty(),
  })
  .strict();

export const OperationEntityMergeJobInputSchema = z
  .object({
    operationId: PositiveIdSchema,
    approvingModeratorId: PositiveIdSchema,
  })
  .strict();

export const EntityMergeJobInputSchema = z.union([
  LegacyEntityMergeJobInputSchema,
  OperationEntityMergeJobInputSchema,
]);

export type EntityMergeJobInput = z.infer<typeof EntityMergeJobInputSchema>;
export type OperationEntityMergeJobInput = z.infer<
  typeof OperationEntityMergeJobInputSchema
>;

export function isOperationEntityMergeJobInput(
  input: EntityMergeJobInput,
): input is OperationEntityMergeJobInput {
  return "operationId" in input;
}

/**
 * Dispatches one operation-backed Entity merge. The operation row, not queue
 * payload duplication, remains authoritative for merge direction and state.
 */
export async function dispatchEntityMergeOperation(rawInput: unknown) {
  const input = OperationEntityMergeJobInputSchema.parse(rawInput);
  return await pushJob("MergeEntity", input, {
    jobId: `MergeEntity-operation-${input.operationId}`,
    removeOnComplete: true,
    removeOnFail: true,
  });
}
