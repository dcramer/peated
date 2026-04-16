import { describe, expect, test } from "vitest";
import {
  RETAILER_LABEL_EXAMPLES,
  WHISKY_LABEL_COMPONENTS,
  buildBottleClassifierInstructions,
  buildWhiskyLabelExtractorInstructions,
} from "./instructions";

describe("bottle-classifier instructions", () => {
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

  test("treats flavored whisky references as non-whisky in both prompts", () => {
    const extractorInstructions = buildWhiskyLabelExtractorInstructions({
      mode: "text",
    });
    const matchInstructions = buildBottleClassifierInstructions({
      maxSearchQueries: 5,
    });

    expect(extractorInstructions).toContain("Skrewball Peanut Butter Whiskey");
    expect(extractorInstructions).toContain("salted caramel");
    expect(extractorInstructions).toContain("return `null`");
    expect(matchInstructions).toContain("Skrewball Peanut Butter Whiskey");
    expect(matchInstructions).toContain("return `no_match`");
  });

  test("builds matching guidance that prefers no-match over a false match", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 5,
      hasBraveWebSearch: true,
    });

    expect(instructions).toContain("House schema conventions:");
    expect(instructions).toContain("search_bottles");
    expect(instructions).toContain("search_entities");
    expect(instructions).toContain("openai_web_search");
    expect(instructions).toContain("brave_web_search");
    expect(instructions).toContain(
      "The input includes `localSearch`, which is the server's initial local bottle search result set.",
    );
    expect(instructions).toContain(
      "If `localSearch.hasExactAliasMatch` is false, no exact alias match was found for the reference.",
    );
    expect(instructions).toContain("matchedReleaseId");
    expect(instructions).toContain("parentBottleId");
    expect(instructions).toContain("create_bottle_and_release");
    expect(instructions).toContain(
      "combined hard limit of 5 web search calls across all web search tools",
    );
    expect(instructions).toContain("Glenmorangie Quinta Ruban 14-year-old");
    expect(instructions).toContain("Wild Turkey Rare Breed Rye");
    expect(instructions).toContain("SMWS RW6.5 Sauna Smoke");
    expect(instructions).toContain("Heaven's Door Bootleg Vol 3 Whiskey");
    expect(instructions).toContain(
      "Four Roses Limited Edition Small Batch 2017",
    );
    expect(instructions).toContain("Highland Park Cask Strength No. 5");
    expect(instructions).toContain(
      "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
    );
    expect(instructions).toContain("over-specific");
    expect(instructions).toContain(
      "call `search_bottles` again with those enriched structured fields",
    );
    expect(instructions).toContain(
      "conflicting retailer subtitle or selector is usually observation-level evidence",
    );
  });

  test("omits entity-search guidance when the entity tool is unavailable", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 5,
      hasEntitySearch: false,
    });

    expect(instructions).not.toContain("search_entities");
    expect(instructions).toContain("search_bottles");
  });

  test("omits Brave guidance when the Brave provider is unavailable", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 5,
    });

    expect(instructions).not.toContain("brave_web_search");
    expect(instructions).toContain("openai_web_search");
  });

  test("builds closed-set guidance when candidate expansion is disabled", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 5,
      hasBottleSearch: false,
      hasOpenAIWebSearch: false,
      hasEntitySearch: false,
    });

    expect(instructions).toContain(
      "No search tools are available for this run",
    );
    expect(instructions).toContain("This run is closed-set.");
    expect(instructions).not.toContain("search_bottles");
    expect(instructions).not.toContain("search_entities");
    expect(instructions).not.toContain("openai_web_search");
  });
});
