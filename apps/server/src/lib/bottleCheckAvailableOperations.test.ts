import {
  PROPOSED_OPERATION_TYPES,
  ProposedOperationSchema,
  type ProposedOperationType,
} from "@peated/bottle-classifier";
import config from "@peated/server/config";
import {
  getAvailableBottleCheckOperations,
  type BottleCheckOperationCapabilities,
} from "./bottleCheckAvailableOperations";

function capabilities(
  enabled: ProposedOperationType[],
): BottleCheckOperationCapabilities {
  return Object.fromEntries(
    PROPOSED_OPERATION_TYPES.map((operationType) => [
      operationType,
      enabled.includes(operationType),
    ]),
  ) as BottleCheckOperationCapabilities;
}

describe("getAvailableBottleCheckOperations", () => {
  test("uses the operation types from the proposal union", () => {
    expect(PROPOSED_OPERATION_TYPES).toEqual(
      ProposedOperationSchema.options.map(
        (operationSchema) => operationSchema.shape.type.value,
      ),
    );
  });

  test("returns no operations while shadow generation is disabled", () => {
    expect(config.BOTTLE_CHECK_SHADOW_GENERATION).toBe(false);
    expect(
      getAvailableBottleCheckOperations(
        capabilities([...PROPOSED_OPERATION_TYPES]),
      ),
    ).toEqual([]);
  });

  test("derives enabled operations from the contract list and workflow capabilities", () => {
    const enabled = [PROPOSED_OPERATION_TYPES[0], PROPOSED_OPERATION_TYPES[3]];

    expect(
      getAvailableBottleCheckOperations(capabilities(enabled), true),
    ).toEqual(enabled);
  });

  test("does not expose an operation unless the workflow explicitly enables it", () => {
    expect(getAvailableBottleCheckOperations(capabilities([]), true)).toEqual(
      [],
    );
  });
});
