import type { ProposedBottle } from "@peated/bottle-classifier/internal/types";
import { materializeBottleIdentity } from "./bottleIdentity";
import {
  buildBottleInputFromProposedBottle,
  buildClassifierBottleInput,
} from "./classifierDecisionCreateInputs";

test("materializes a classifier draft into one independently complete Bottle", () => {
  const proposedBottle: ProposedBottle = {
    name: "A Midwinter Night's Dram",
    series: { id: null, name: "A Midwinter Night's Dram" },
    category: "rye",
    edition: "Act 10 Scene 4",
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    caskType: "ruby_port",
    caskSize: "barrel",
    caskFill: "2nd_fill",
    abv: 49.3,
    vintageYear: null,
    releaseYear: 2022,
    brand: { id: 1750, name: "High West" },
    distillers: [{ id: 1750, name: "High West" }],
    bottler: null,
  };

  const routeInput = buildBottleInputFromProposedBottle(proposedBottle);
  const bottleInput = buildClassifierBottleInput(proposedBottle);

  expect(routeInput).toMatchObject({
    caskType: "ruby_port",
    caskSize: "barrel",
    caskFill: "2nd_fill",
  });
  expect(bottleInput.stable.name).toBe("A Midwinter Night's Dram");
  expect(bottleInput.exact).toMatchObject({
    edition: "Act 10 Scene 4",
    releaseYear: 2022,
    abv: 49.3,
    caskType: "ruby_port",
    caskSize: "barrel",
    caskFill: "2nd_fill",
  });
  expect(
    materializeBottleIdentity({
      stable: {
        name: bottleInput.stable.name,
        fullName: `High West ${bottleInput.stable.name}`,
        statedAge: bottleInput.stable.statedAge,
      },
      exact: {
        edition: bottleInput.exact.edition ?? null,
        statedAge: bottleInput.exact.statedAge ?? null,
        releaseYear: bottleInput.exact.releaseYear ?? null,
        vintageYear: bottleInput.exact.vintageYear ?? null,
        abv: bottleInput.exact.abv ?? null,
        singleCask: bottleInput.exact.singleCask ?? null,
        caskStrength: bottleInput.exact.caskStrength ?? null,
        caskType: bottleInput.exact.caskType ?? null,
        caskSize: bottleInput.exact.caskSize ?? null,
        caskFill: bottleInput.exact.caskFill ?? null,
      },
    }),
  ).toEqual({
    name: "A Midwinter Night's Dram - Act 10 Scene 4 - 2022 Release - 49.3% ABV - Ruby Port Cask - Barrel - 2nd Fill",
    fullName:
      "High West A Midwinter Night's Dram - Act 10 Scene 4 - 2022 Release - 49.3% ABV - Ruby Port Cask - Barrel - 2nd Fill",
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
    caskType: null,
    caskSize: null,
    caskFill: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: { id: null, name: "Shieldaig" },
    distillers: [],
    bottler: null,
  };

  const bottleInput = buildClassifierBottleInput(proposedBottle);

  expect(bottleInput.stable.statedAge).toBeNull();
  expect(bottleInput.exact.statedAge).toBe(12);
  expect(
    materializeBottleIdentity({
      stable: {
        name: bottleInput.stable.name,
        fullName: `Shieldaig ${bottleInput.stable.name}`,
        statedAge: bottleInput.stable.statedAge,
      },
      exact: {
        edition: bottleInput.exact.edition ?? null,
        statedAge: bottleInput.exact.statedAge ?? null,
        releaseYear: bottleInput.exact.releaseYear ?? null,
        vintageYear: bottleInput.exact.vintageYear ?? null,
        abv: bottleInput.exact.abv ?? null,
        singleCask: bottleInput.exact.singleCask ?? null,
        caskStrength: bottleInput.exact.caskStrength ?? null,
        caskType: bottleInput.exact.caskType ?? null,
        caskSize: bottleInput.exact.caskSize ?? null,
        caskFill: bottleInput.exact.caskFill ?? null,
      },
    }),
  ).toEqual({
    name: "Speyside 12-year-old",
    fullName: "Shieldaig Speyside 12-year-old",
    statedAge: 12,
  });
});
