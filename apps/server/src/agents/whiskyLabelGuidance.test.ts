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

    expect(instructions).toContain(
      "When a component is ambiguous, leave it `null` or `[]` instead of guessing.",
    );
    expect(instructions).toContain(
      "Maker's Mark Private Selection Kentucky Bourbon Whisky S2B13",
    );
    expect(instructions).toContain(
      "Gold Bar Black Double Cask Straight Bourbon Whiskey",
    );
    expect(instructions).toContain('"expression": "Black Double Cask"');
    expect(instructions).toContain("bottler");
    expect(instructions).toContain("cask_size");
    expect(instructions).toContain("cask_fill");
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
      "For `proposedBottle.name`, follow the bottle's evidenced canonical name, not a mechanically copied retailer title.",
    );
    expect(instructions).toContain(
      "`category` should be normalized to the house values. If the whisky type is unclear, leave `category` as `null` instead of using a fallback bucket.",
    );
    expect(instructions).toContain(
      "If the listing is clearly another spirit category such as vodka, gin, rum, tequila, or mezcal, return `no_match`.",
    );
    expect(instructions).toContain(
      "If `localSearch.hasExactAliasMatch` is false and you do not have authoritative web evidence, you can still return `create_new`, but do not assume the server will auto-create it.",
    );
    expect(instructions).toContain(
      "Exact or near-exact ABV is a strong positive signal when the base identity already aligns and competing candidates do not share that ABV.",
    );
    expect(instructions).toContain(
      "When ABV sharply separates one candidate from the others, let that raise confidence materially instead of treating it as a minor tiebreaker.",
    );
    expect(instructions).toContain(
      "`Barrel Strength`, `Barrel Proof`, `Full Proof`, and `Natural Strength` all imply `caskStrength: true`.",
    );
    expect(instructions).toContain(
      "If `proposedBottle.edition`, `proposedBottle.releaseYear`, or `proposedBottle.vintageYear` is set, do not repeat that same batch code or year in `proposedBottle.name`",
    );
    expect(instructions).toContain(
      "A false positive match is worse than returning `no_match` or a lower-confidence review candidate.",
    );
    expect(instructions).toContain(
      "If identity evidence is weak, conflicting, or missing on the decisive components, do not force a match.",
    );
    expect(instructions).toContain(
      "The input includes `localSearch`, which is the server's initial local bottle search result set.",
    );
    expect(instructions).toContain(
      "If `localSearch.hasExactAliasMatch` is false, no exact alias match was found for the listing.",
    );
    expect(instructions).toContain(
      "Local candidates may include structured bottle fields such as brand, bottler, distillery, series, category, age, edition, cask type, cask size, cask fill, cask-strength, single-cask, ABV, and release years.",
    );
    expect(instructions).toContain(
      "Before returning `create_new`, use `openai_web_search` to validate the bottle traits that make the listing distinct unless local evidence is already decisive.",
    );
    expect(instructions).toContain(
      "When searching, prioritize official producer, distillery, bottler, or importer domains first, then critics or publications, then broader web if still unresolved.",
    );
    expect(instructions).toContain(
      "Do not treat the originating retailer as decisive evidence for differentiating traits such as distillery, bottler, cask finish, cask size, cask fill, ABV, edition, or release year.",
    );
    expect(instructions).toContain(
      "If the distinctness of the bottle depends on a trait such as `Port Cask Finished`, `Single Cask`, `Barrel Proof`, a specific ABV, `1st Fill`, or `Port Pipe`, the web evidence should explicitly confirm that trait.",
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
