import {
  getBottleExactIdentity,
  materializeBottleForGroup,
  materializeBottleIdentity,
} from "./bottleIdentity";

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
    materializeBottleIdentity({
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

test("classifies patched exact identity against the source group age", () => {
  expect(
    getBottleExactIdentity({
      bottle: { ...exactIdentity, statedAge: 13 },
      sourceGroupStatedAge: 12,
    }),
  ).toEqual({ ...exactIdentity, statedAge: 13 });

  expect(
    getBottleExactIdentity({
      bottle: { ...exactIdentity, statedAge: 13 },
      sourceGroupStatedAge: 12,
      exactPatch: { edition: "Batch 2", statedAge: 12, abv: 48 },
    }),
  ).toEqual({
    ...exactIdentity,
    edition: "Batch 2",
    statedAge: null,
    abv: 48,
  });
});

test("materializes only durable shared Bottle fields", () => {
  expect(
    materializeBottleForGroup({
      group: {
        name: "Old Malt",
        fullName: "Example Brand Old Malt",
        statedAge: 12,
        brandId: 1,
        bottlerId: 2,
        seriesId: 3,
        category: "single_malt",
        flavorProfile: "peated",
      },
      exact: { ...exactIdentity, edition: "Batch 2", statedAge: 13 },
    }),
  ).toEqual({
    name: "Old Malt - Batch 2 - 13-year-old",
    fullName: "Example Brand Old Malt - Batch 2 - 13-year-old",
    statedAge: 13,
    brandId: 1,
    bottlerId: 2,
    seriesId: 3,
    category: "single_malt",
    flavorProfile: "peated",
  });
});
