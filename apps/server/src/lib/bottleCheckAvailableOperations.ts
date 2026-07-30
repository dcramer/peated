import {
  PROPOSED_OPERATION_TYPES,
  type ProposedOperationType,
} from "@peated/bottle-classifier";
import config from "@peated/server/config";

export type BottleCheckOperationCapabilities = Readonly<
  Record<ProposedOperationType, boolean>
>;

export function getAvailableBottleCheckOperations(
  capabilities: BottleCheckOperationCapabilities,
  shadowGenerationEnabled = config.BOTTLE_CHECK_SHADOW_GENERATION,
): ProposedOperationType[] {
  if (!shadowGenerationEnabled) return [];

  return PROPOSED_OPERATION_TYPES.filter(
    (operationType) => capabilities[operationType] === true,
  );
}
