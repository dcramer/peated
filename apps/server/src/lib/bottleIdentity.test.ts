import {
  getBottleExactIdentity,
  materializeBottleForGroup,
  materializeBottleIdentity,
} from "./bottleIdentity";

const exactIdentity = {
  edition: null,
  statedAge: null,
  noAgeStatement: null,
  bottlingYear: null,
  releaseYear: null,
  releaseMonth: null,
  releaseDay: null,
  vintageYear: null,
  abv: null,
  singleCask: null,
  caskStrength: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
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

test("keeps a confirmed NAS Bottle separate from an inherited group age", () => {
  expect(
    materializeBottleIdentity({
      stable: {
        name: "Old Malt",
        fullName: "Example Brand Old Malt",
        statedAge: 12,
      },
      exact: { ...exactIdentity, noAgeStatement: true },
    }),
  ).toEqual({
    name: "Old Malt",
    fullName: "Example Brand Old Malt",
    statedAge: null,
  });
});

test("keeps an SMWS cask name stable when exact details change", () => {
  expect(
    materializeBottleIdentity({
      stable: {
        name: "64.149 A cake walk in the Black Forest",
        fullName: "SMWS 64.149 A cake walk in the Black Forest",
        statedAge: null,
      },
      exact: {
        ...exactIdentity,
        statedAge: 17,
        releaseYear: 2023,
        vintageYear: 2006,
        abv: 56.6,
        singleCask: false,
        caskStrength: true,
        caskNumber: "64.149",
      },
    }),
  ).toEqual({
    name: "64.149 A cake walk in the Black Forest",
    fullName: "SMWS 64.149 A cake walk in the Black Forest",
    statedAge: 17,
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
