import type { RetiredCatalogTargetReplacement } from "@peated/server/lib/catalogTargets";
import {
  BottleGroupRetiredTargetDataSchema,
  type BottleGroupRetiredTargetData,
} from "@peated/server/schemas";

/** Preserves canonical retired-target identity in the public conflict payload. */
export function serializeBottleGroupRetiredTargetData(
  replacement: RetiredCatalogTargetReplacement | null,
): BottleGroupRetiredTargetData {
  return BottleGroupRetiredTargetDataSchema.parse({ replacement });
}
