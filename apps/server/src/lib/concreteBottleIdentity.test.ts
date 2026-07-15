import { materializeConcreteBottleIdentity } from "./concreteBottleIdentity";

const exactIdentity = {
  edition: null,
  statedAge: null,
  releaseYear: null,
  vintageYear: null,
  abv: null,
  singleCask: null,
  caskStrength: null,
  caskType: null,
  caskSize: null,
  caskFill: null,
};

test.each([
  {
    label: "materializes a stable age",
    exactStatedAge: null,
    expectedName: "Old Malt",
    expectedStatedAge: 12,
  },
  {
    label: "preserves a differing exact age",
    exactStatedAge: 13,
    expectedName: "Old Malt - 13-year-old",
    expectedStatedAge: 13,
  },
  {
    label: "normalizes an equal exact age to shared inheritance",
    exactStatedAge: 12,
    expectedName: "Old Malt",
    expectedStatedAge: 12,
  },
])("$label", ({ exactStatedAge, expectedName, expectedStatedAge }) => {
  expect(
    materializeConcreteBottleIdentity({
      stable: {
        name: "Old Malt",
        fullName: "Example Brand Old Malt",
        statedAge: 12,
      },
      exact: { ...exactIdentity, statedAge: exactStatedAge },
    }),
  ).toEqual({
    name: expectedName,
    fullName: `Example Brand ${expectedName}`,
    statedAge: expectedStatedAge,
  });
});
