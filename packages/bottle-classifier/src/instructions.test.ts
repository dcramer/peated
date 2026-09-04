import { describe, expect, test } from "vitest";
import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
  buildWhiskyLabelExtractorInstructions,
  WHISKY_LABEL_COMPONENTS,
} from "./instructions";

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
});
