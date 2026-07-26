import { ConcreteBottleCreateInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import {
  BottleInputSchema,
  BottleReleaseInputSchema,
} from "@peated/server/schemas";
import {
  buildPriceMatchConcreteBottleInput,
  InvalidPriceMatchConcreteBottleInputError,
} from "./priceMatchConcreteBottleInput";

const bottleInput = BottleInputSchema.parse({
  name: "Shared Expression",
  statedAge: 12,
  series: 3,
  category: "single_malt",
  brand: 1,
  distillers: [2],
  bottler: 4,
  flavorProfile: "peated",
  edition: "Bottle Edition",
  abv: 46,
  singleCask: false,
  caskStrength: true,
  vintageYear: 2008,
  releaseYear: 2020,
  caskSize: "barrel",
  caskType: "bourbon",
  caskFill: "1st_fill",
  description: "Bottle description",
  descriptionSrc: "user",
  tastingNotes: {
    nose: "Bottle nose",
    palate: "Bottle palate",
    finish: "Bottle finish",
  },
});

const releaseInput = BottleReleaseInputSchema.parse({
  edition: "Release Edition",
  statedAge: 13,
  abv: 55,
  singleCask: true,
  caskStrength: false,
  vintageYear: 2009,
  releaseYear: 2022,
  caskSize: "hogshead",
  caskType: "oloroso",
  caskFill: "refill",
  description: "Release description",
  tastingNotes: {
    nose: "Release nose",
    palate: "Release palate",
    finish: "Release finish",
  },
});

const sourceBottleStableInput = {
  name: "Shared Expression",
  statedAge: 12,
  series: 3,
  category: "single_malt" as const,
  brand: 1,
  distillers: [2],
  bottler: 4,
  flavorProfile: "peated" as const,
};

test("maps bottle creation to an independent concrete Bottle", () => {
  const result = buildPriceMatchConcreteBottleInput({
    bottleInput,
    parentBottleId: null,
  });

  expect(result.creationTarget).toBe("bottle");
  expect(result.input).toEqual({
    stable: {
      name: "Shared Expression",
      statedAge: 12,
      series: 3,
      category: "single_malt",
      brand: 1,
      distillers: [2],
      bottler: 4,
      flavorProfile: "peated",
    },
    exact: {
      edition: "Bottle Edition",
      statedAge: null,
      abv: 46,
      singleCask: false,
      caskStrength: true,
      vintageYear: 2008,
      releaseYear: 2020,
      caskSize: "barrel",
      caskType: "bourbon",
      caskFill: "1st_fill",
      description: "Bottle description",
      descriptionSrc: "user",
      tastingNotes: {
        nose: "Bottle nose",
        palate: "Bottle palate",
        finish: "Bottle finish",
      },
    },
  });
  expect(ConcreteBottleCreateInputSchema.parse(result.input)).toEqual(
    result.input,
  );
});

test("maps release creation from copied source evidence to an independent Bottle", () => {
  const result = buildPriceMatchConcreteBottleInput({
    releaseInput,
    parentBottleId: 42,
    sourceBottleStableInput,
  });

  expect(result.creationTarget).toBe("release");
  expect(result.input).toEqual({
    stable: sourceBottleStableInput,
    exact: {
      edition: "Release Edition",
      statedAge: 13,
      abv: 55,
      singleCask: true,
      caskStrength: false,
      vintageYear: 2009,
      releaseYear: 2022,
      caskSize: "hogshead",
      caskType: "oloroso",
      caskFill: "refill",
      description: "Release description",
      descriptionSrc: null,
      tastingNotes: {
        nose: "Release nose",
        palate: "Release palate",
        finish: "Release finish",
      },
    },
  });
  expect(result.input).not.toHaveProperty("sourceBottleId");
  expect(result.input).not.toHaveProperty("groupId");
  expect(ConcreteBottleCreateInputSchema.parse(result.input)).toEqual(
    result.input,
  );
});

test("maps combined creation with release precedence and Bottle fallback", () => {
  const partialRelease = BottleReleaseInputSchema.parse({
    edition: "Release Edition",
    statedAge: null,
    abv: null,
    singleCask: false,
    caskStrength: null,
    vintageYear: null,
    releaseYear: 2022,
    caskSize: null,
    caskType: "oloroso",
    caskFill: null,
    description: null,
    tastingNotes: null,
  });
  const result = buildPriceMatchConcreteBottleInput({
    bottleInput,
    releaseInput: partialRelease,
    parentBottleId: null,
  });

  expect(result.creationTarget).toBe("bottle_and_release");
  expect(result.input.stable.statedAge).toBe(12);
  expect(result.input.exact).toEqual({
    edition: "Release Edition",
    statedAge: null,
    abv: 46,
    singleCask: false,
    caskStrength: true,
    vintageYear: 2008,
    releaseYear: 2022,
    caskSize: "barrel",
    caskType: "oloroso",
    caskFill: "1st_fill",
    description: "Bottle description",
    descriptionSrc: "user",
    tastingNotes: {
      nose: "Bottle nose",
      palate: "Bottle palate",
      finish: "Bottle finish",
    },
  });
  expect(ConcreteBottleCreateInputSchema.parse(result.input)).toEqual(
    result.input,
  );
});

test("drops Bottle description provenance when Release description wins", () => {
  const result = buildPriceMatchConcreteBottleInput({
    bottleInput,
    releaseInput,
    parentBottleId: null,
  });

  expect(result.input.exact.description).toBe("Release description");
  expect(result.input.exact.descriptionSrc).toBeNull();
  expect(result.input.exact.tastingNotes).toEqual(releaseInput.tastingNotes);
});

test("rejects empty creation input", () => {
  expect(() =>
    buildPriceMatchConcreteBottleInput({
      parentBottleId: null,
    }),
  ).toThrow(InvalidPriceMatchConcreteBottleInputError);
});

test("requires parent Bottle context for release creation", () => {
  expect(() =>
    buildPriceMatchConcreteBottleInput({
      releaseInput,
      parentBottleId: null,
    }),
  ).toThrow("requires a valid parent Bottle id");
});

test("requires a validated source snapshot for release creation", () => {
  expect(() =>
    buildPriceMatchConcreteBottleInput({
      releaseInput,
      parentBottleId: 42,
    }),
  ).toThrow("requires a validated source Bottle snapshot");
});

test.each([
  ["bottle", bottleInput, undefined],
  ["combined", bottleInput, releaseInput],
] as const)(
  "rejects parent Bottle context for %s creation",
  (_label, nextBottleInput, nextReleaseInput) => {
    expect(() =>
      buildPriceMatchConcreteBottleInput({
        bottleInput: nextBottleInput,
        releaseInput: nextReleaseInput,
        parentBottleId: 42,
      }),
    ).toThrow("cannot include a parent Bottle id");
  },
);

test.each([
  [
    "Bottle imageUrl",
    { ...bottleInput, imageUrl: "https://example.com/bottle.jpg" },
    releaseInput,
  ],
  [
    "Release imageUrl",
    bottleInput,
    { ...releaseInput, imageUrl: "https://example.com/release.jpg" },
  ],
] as const)("rejects a non-null legacy %s", (_label, bottle, release) => {
  expect(() =>
    buildPriceMatchConcreteBottleInput({
      bottleInput: bottle,
      releaseInput: release,
      parentBottleId: null,
    }),
  ).toThrow(InvalidPriceMatchConcreteBottleInputError);
});

test.each([
  ["fractional age", { statedAge: 12.5 }],
  ["next-year vintage", { vintageYear: new Date().getFullYear() + 1 }],
  ["next-year release", { releaseYear: new Date().getFullYear() + 1 }],
] as const)(
  "rejects legacy release %s outside the canonical contract",
  (_, patch) => {
    const legacyRelease = BottleReleaseInputSchema.parse({
      ...releaseInput,
      ...patch,
    });

    expect(() =>
      buildPriceMatchConcreteBottleInput({
        releaseInput: legacyRelease,
        parentBottleId: 42,
        sourceBottleStableInput,
      }),
    ).toThrow(InvalidPriceMatchConcreteBottleInputError);
    expect(() =>
      buildPriceMatchConcreteBottleInput({
        releaseInput: legacyRelease,
        parentBottleId: 42,
        sourceBottleStableInput,
      }),
    ).toThrow(/not valid canonical Bottle data/);
  },
);
