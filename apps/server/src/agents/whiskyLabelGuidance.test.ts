import { describe, expect, test } from "vitest";
import {
  RETAILER_LABEL_EXAMPLES,
  WHISKY_LABEL_COMPONENTS,
  buildStorePriceMatchInstructions,
  buildWhiskyLabelExtractorInstructions,
} from "./whisky/guidance";

describe("whiskyLabelGuidance", () => {
  test("covers the bottle identity components used by extraction", () => {
    expect(WHISKY_LABEL_COMPONENTS.map((component) => component.id)).toEqual(
      expect.arrayContaining([
        "producer",
        "bottler",
        "distillery",
        "expression",
        "series",
        "edition",
        "category",
        "age",
        "cask",
        "strength",
        "technical",
      ]),
    );
  });

  test("keeps current retailer failure-mode examples in the prompt source", () => {
    expect(RETAILER_LABEL_EXAMPLES.map((example) => example.source)).toEqual(
      expect.arrayContaining([
        "Total Wine",
        "Astor Wines",
        "ReserveBar",
        "Wooden Cork",
      ]),
    );
  });

  test("builds extraction guidance that prefers nulls over guesses", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "text",
    });

    expect(instructions).toContain("Mode-specific rules:");
    expect(instructions).toContain("Bottle identity components:");
    expect(instructions).toContain("Output requirements:");

    for (const component of WHISKY_LABEL_COMPONENTS) {
      expect(instructions).toContain(component.outputField);
    }

    for (const example of RETAILER_LABEL_EXAMPLES) {
      expect(instructions).toContain(example.label);
    }
  });

  test("builds matching guidance that prefers no-match over a false match", () => {
    const instructions = buildStorePriceMatchInstructions({
      maxSearchQueries: 5,
    });

    expect(instructions).toContain("House schema conventions:");
    expect(instructions).toContain("search_bottles");
    expect(instructions).toContain("search_entities");
    expect(instructions).toContain("openai_web_search");
    expect(instructions).toContain(
      "The input includes `localSearch`, which is the server's initial local bottle search result set.",
    );
    expect(instructions).toContain(
      "If `localSearch.hasExactAliasMatch` is false, no exact alias match was found for the listing.",
    );
    expect(instructions).toContain("creationTarget");
    expect(instructions).toContain("suggestedReleaseId");
    expect(instructions).toContain("You have a hard limit of 5 search calls.");
  });
});
