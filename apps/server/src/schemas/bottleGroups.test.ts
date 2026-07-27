import { BottleGroupReplacementDataSchema } from "./bottleGroups";

describe("BottleGroupReplacementDataSchema", () => {
  test("preserves the replacement BottleGroup id", () => {
    const payload = { replacementGroupId: 12 };

    expect(BottleGroupReplacementDataSchema.parse(payload)).toEqual(payload);
  });
});
