import { BottleGroupRetiredTargetDataSchema } from "./bottleGroups";

describe("BottleGroupRetiredTargetDataSchema", () => {
  test("preserves null, generic-group, and exact-Bottle replacement identity", () => {
    const payloads = [
      { replacement: null },
      { replacement: { kind: "group", groupId: 12 } },
      { replacement: { kind: "bottle", bottleId: 34 } },
    ] as const;

    expect(
      payloads.map((payload) =>
        BottleGroupRetiredTargetDataSchema.parse(payload),
      ),
    ).toEqual(payloads);
  });
});
