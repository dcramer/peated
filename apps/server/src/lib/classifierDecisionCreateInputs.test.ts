import type { ProposedBottle } from "@peated/bottle-classifier/internal/types";
import { buildClassifierConcreteBottleInput } from "./classifierDecisionCreateInputs";
import { materializeConcreteBottleIdentity } from "./concreteBottleIdentity";

test("materializes a classifier draft into one independently complete Bottle", () => {
  const proposedBottle: ProposedBottle = {
    name: "A Midwinter Night's Dram",
    series: { id: null, name: "A Midwinter Night's Dram" },
    category: "rye",
    edition: "Act 10 Scene 4",
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    abv: 49.3,
    vintageYear: null,
    releaseYear: 2022,
    brand: { id: 1750, name: "High West" },
    distillers: [{ id: 1750, name: "High West" }],
    bottler: null,
  };

  const concreteInput = buildClassifierConcreteBottleInput(proposedBottle);

  expect(concreteInput.kind).toBe("independent");
  if (concreteInput.kind !== "independent") {
    throw new Error("classifier drafts must create independent Bottles");
  }

  expect(concreteInput.stable.name).toBe("A Midwinter Night's Dram");
  expect(concreteInput.exact).toMatchObject({
    edition: "Act 10 Scene 4",
    releaseYear: 2022,
    abv: 49.3,
  });
  expect(
    materializeConcreteBottleIdentity({
      stable: {
        name: concreteInput.stable.name,
        fullName: `High West ${concreteInput.stable.name}`,
        statedAge: concreteInput.stable.statedAge,
      },
      exact: {
        edition: concreteInput.exact.edition ?? null,
        statedAge: concreteInput.exact.statedAge ?? null,
        releaseYear: concreteInput.exact.releaseYear ?? null,
        vintageYear: concreteInput.exact.vintageYear ?? null,
        abv: concreteInput.exact.abv ?? null,
        singleCask: concreteInput.exact.singleCask ?? null,
        caskStrength: concreteInput.exact.caskStrength ?? null,
        caskType: concreteInput.exact.caskType ?? null,
        caskSize: concreteInput.exact.caskSize ?? null,
        caskFill: concreteInput.exact.caskFill ?? null,
      },
    }),
  ).toEqual({
    name: "A Midwinter Night's Dram - Act 10 Scene 4 - 2022 Release - 49.3% ABV",
    fullName:
      "High West A Midwinter Night's Dram - Act 10 Scene 4 - 2022 Release - 49.3% ABV",
    statedAge: null,
  });
});

test("keeps a marketed age exact without duplicating its name wording", () => {
  const proposedBottle: ProposedBottle = {
    name: "Speyside 12-year-old",
    series: null,
    category: "single_malt",
    edition: null,
    statedAge: 12,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: { id: null, name: "Shieldaig" },
    distillers: [],
    bottler: null,
  };

  const concreteInput = buildClassifierConcreteBottleInput(proposedBottle);

  expect(concreteInput.kind).toBe("independent");
  if (concreteInput.kind !== "independent") {
    throw new Error("classifier drafts must create independent Bottles");
  }

  expect(concreteInput.stable.statedAge).toBeNull();
  expect(concreteInput.exact.statedAge).toBe(12);
  expect(
    materializeConcreteBottleIdentity({
      stable: {
        name: concreteInput.stable.name,
        fullName: `Shieldaig ${concreteInput.stable.name}`,
        statedAge: concreteInput.stable.statedAge,
      },
      exact: {
        edition: concreteInput.exact.edition ?? null,
        statedAge: concreteInput.exact.statedAge ?? null,
        releaseYear: concreteInput.exact.releaseYear ?? null,
        vintageYear: concreteInput.exact.vintageYear ?? null,
        abv: concreteInput.exact.abv ?? null,
        singleCask: concreteInput.exact.singleCask ?? null,
        caskStrength: concreteInput.exact.caskStrength ?? null,
        caskType: concreteInput.exact.caskType ?? null,
        caskSize: concreteInput.exact.caskSize ?? null,
        caskFill: concreteInput.exact.caskFill ?? null,
      },
    }),
  ).toEqual({
    name: "Speyside 12-year-old",
    fullName: "Shieldaig Speyside 12-year-old",
    statedAge: 12,
  });
});
