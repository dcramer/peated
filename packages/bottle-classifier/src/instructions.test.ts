import { describe, expect, test } from "vitest";
import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
  buildWhiskyLabelExtractorInstructions,
  WHISKY_LABEL_COMPONENTS,
} from "./instructions";

describe("identity rules", () => {
  test.each([
    ["reference classifier", buildBottleClassifierInstructions()],
    ["Bottle audit", buildBottleAuditInstructions()],
  ])("state the naming rules once in %s", (_, instructions) => {
    expect(instructions).toContain("<identity_rules>");
    expect(
      instructions.split("never build a name from other fields"),
    ).toHaveLength(2);
    expect(instructions).toContain(
      "is the name only when nothing else names the Bottle",
    );
  });

  test.each([
    ["reference classifier", buildBottleClassifierInstructions()],
    ["Bottle audit", buildBottleAuditInstructions()],
  ])(
    "names a distillery Bottle by vintage and keeps release facts out in %s",
    (_, instructions) => {
      expect(instructions).toContain("`Mortlach 1990`");
      expect(instructions).toContain(
        "Add the printed age after the vintage only when a Bottle of the same Brand has the same distillery and vintage",
      );
      expect(instructions).toContain(
        "Put every printed cask or barrel identifier in `caskNumber`, never in `edition`",
      );
    },
  );

  test("extracts a cask identifier into cask_number, not edition", () => {
    const edition = WHISKY_LABEL_COMPONENTS.find(({ id }) => id === "edition");
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "image",
    });

    expect(edition?.guidance).toContain(
      "Put a cask or barrel identifier in `cask_number`, never in `edition`.",
    );
    expect(instructions).not.toContain(
      "preserve its full wording in `edition`",
    );
  });
});

describe("bottler instructions", () => {
  test.each([
    ["reference classifier", buildBottleClassifierInstructions()],
    ["Bottle audit", buildBottleAuditInstructions()],
    [
      "label extraction",
      buildWhiskyLabelExtractorInstructions({ mode: "image" }),
    ],
  ])(
    "keeps official releases separate from independent bottlings in %s",
    (_, instructions) => {
      expect(instructions).toContain(
        "business that independently selects and releases whisky made by another producer",
      );
      expect(instructions).toContain(
        "An official Brand or distillery release has no bottler",
      );
      expect(instructions).not.toContain(
        "market-facing bottler or release imprint",
      );
    },
  );

  test.each([
    buildBottleClassifierInstructions(),
    buildBottleAuditInstructions(),
  ])(
    "keeps an evidenced independent bottler that is also the Brand",
    (instructions) => {
      expect(instructions).toContain("The bottler may also be the Brand");
    },
  );

  test.each([
    buildBottleClassifierInstructions(),
    buildBottleAuditInstructions(),
  ])(
    "does not treat another Bottle's stored bottler as evidence",
    (instructions) => {
      expect(instructions).toContain(
        "Another Bottle's stored `bottler` is not evidence for this Bottle's `bottler`",
      );
    },
  );

  test("defines the extracted bottler as an independent release role", () => {
    const bottler = WHISKY_LABEL_COMPONENTS.find(({ id }) => id === "bottler");

    expect(bottler?.guidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "business that independently selects and releases whisky made by another producer",
        ),
        expect.stringContaining(
          "official Brand or distillery release has no bottler",
        ),
        expect.stringContaining("bottler may also be `brand`"),
      ]),
    );
  });

  test("keeps Gordon & MacPhail as Brand and bottler", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "text",
    });
    const start = instructions.indexOf(
      "Input: `Gordon & MacPhail Caol Ila 12 Year First Fill Bourbon Cask`",
    );
    const end = instructions.indexOf("\n\nInput:", start);
    const example = instructions.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(example).toContain('"brand": "Gordon & MacPhail"');
    expect(example).toContain('"bottler": "Gordon & MacPhail"');
    expect(example).toContain('"Caol Ila"');
  });
});
