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
      expect.arrayContaining(["Total Wine", "Astor Wines", "ReserveBar"]),
    );
  });

  test("builds extraction guidance that prefers nulls over guesses", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "text",
    });

    expect(instructions).toContain(
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing.",
    );
    expect(instructions).toContain(
      "Maker's Mark Private Selection Kentucky Bourbon Whisky S2B13",
    );
    expect(instructions).toContain("cask_strength");
    expect(instructions).toContain("single_cask");
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
      "`series` is a stable range or family. `edition` is a batch, store-pick code, release code, or numbered variant.",
    );
    expect(instructions).toContain(
      "A false positive match is worse than returning `no_match` or a lower-confidence review candidate.",
    );
    expect(instructions).toContain(
      "If identity evidence is weak, conflicting, or missing on the decisive components, do not force a match.",
    );
    expect(instructions).toContain(
      "Before returning `create_new`, use `openai_web_search` to validate that the listing appears to be a real distinct bottling unless local evidence is already decisive.",
    );
    expect(instructions).toContain(
      "When you are leaning toward `create_new` or `no_match` because local candidates are weak, do at least one web search while search budget remains.",
    );
    expect(instructions).toContain(
      "Do not return `create_new` from sparse local evidence alone when a web search could still confirm or refute the bottle identity.",
    );
    expect(instructions).toContain("You have a hard limit of 5 search calls.");
  });
});
