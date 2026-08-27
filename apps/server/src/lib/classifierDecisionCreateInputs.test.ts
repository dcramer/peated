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
    maturation: "ruby_port",
    caskNumber: "#1234",
    outturn: 200,
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
    maturation: "ruby_port",
    caskNumber: "#1234",
    outturn: 200,
  });
  expect(bottleInput.name).toBe("A Midwinter Night's Dram");
  expect(bottleInput).toMatchObject({
    edition: "Act 10 Scene 4",
    releaseYear: 2022,
    abv: 49.3,
    maturation: "ruby_port",
    caskNumber: "#1234",
    outturn: 200,
  });
  expect(
    materializeBottleIdentity({
      stable: {
        name: bottleInput.name,
        fullName: `High West ${bottleInput.name}`,
        statedAge: null,
      },
      exact: {
        edition: bottleInput.edition ?? null,
        statedAge: bottleInput.statedAge ?? null,
        releaseYear: bottleInput.releaseYear ?? null,
        vintageYear: bottleInput.vintageYear ?? null,
        abv: bottleInput.abv ?? null,
        singleCask: bottleInput.singleCask ?? null,
        caskStrength: bottleInput.caskStrength ?? null,
        maturation: bottleInput.maturation ?? null,
        caskNumber: bottleInput.caskNumber ?? null,
        outturn: bottleInput.outturn ?? null,
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
    maturation: null,
    caskNumber: null,
    outturn: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: { id: null, name: "Shieldaig" },
    distillers: [],
    bottler: null,
  };

  const bottleInput = buildClassifierBottleInput(proposedBottle);

  expect(bottleInput.statedAge).toBe(12);
  expect(
    materializeBottleIdentity({
      stable: {
        name: bottleInput.name,
        fullName: `Shieldaig ${bottleInput.name}`,
        statedAge: null,
      },
      exact: {
        edition: bottleInput.edition ?? null,
        statedAge: bottleInput.statedAge ?? null,
        releaseYear: bottleInput.releaseYear ?? null,
        vintageYear: bottleInput.vintageYear ?? null,
        abv: bottleInput.abv ?? null,
        singleCask: bottleInput.singleCask ?? null,
        caskStrength: bottleInput.caskStrength ?? null,
        maturation: bottleInput.maturation ?? null,
        caskNumber: bottleInput.caskNumber ?? null,
        outturn: bottleInput.outturn ?? null,
      },
    }),
  ).toEqual({
    name: "Speyside 12-year-old",
    fullName: "Shieldaig Speyside 12-year-old",
    statedAge: 12,
  });
});

test("keeps a classifier-proposed kind for a new Entity", () => {
  const proposedBottle: ProposedBottle = {
    name: "Hedonism",
    series: null,
    category: "blend",
    edition: null,
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    maturation: null,
    caskNumber: null,
    outturn: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: { id: null, name: "Compass Box", kind: "blender" },
    distillers: [],
    bottler: null,
  };

  expect(
    buildBottleInputFromProposedBottle(proposedBottle).brand,
  ).toMatchObject({
    name: "Compass Box",
    kind: "blender",
  });
});

test("uses Bottle relationship defaults when a new Entity has no kind", () => {
  const proposedBottle: ProposedBottle = {
    name: "Test Blend",
    series: null,
    category: "blend",
    edition: null,
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    maturation: null,
    caskNumber: null,
    outturn: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: { id: null, name: "Test Brand" },
    distillers: [{ id: null, name: "Test Distillery" }],
    bottler: { id: null, name: "Test Bottler" },
  };

  expect(buildBottleInputFromProposedBottle(proposedBottle)).toMatchObject({
    brand: { name: "Test Brand", kind: "brand" },
    distillers: [{ name: "Test Distillery", kind: "distillery" }],
    bottler: { name: "Test Bottler", kind: "bottler" },
  });
});
