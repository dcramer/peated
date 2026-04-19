import { describe, expect, test } from "vitest";
import {
  buildBottleClassifierInstructions,
  buildWhiskyLabelExtractorInstructions,
} from "./instructions";

describe("instructions", () => {
  test("teaches the extractor to treat year-first annual families as release years", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "text",
    });

    expect(instructions).toContain(
      "prefer `release_year` over `vintage_year` even if the year appears before the family wording",
    );
  });

  test("teaches the classifier to keep annual family years at release scope", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 3,
    });

    expect(instructions).toContain(
      "Do not treat a year-first title as bottle-level year identity by default",
    );
    expect(instructions).toContain(
      "do not leave that differentiator stranded on `proposedBottle`",
    );
  });

  test("teaches the classifier not to reject short self-contained bottle families", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 3,
    });

    expect(instructions).toContain(
      "Do not call a reference too sparse solely because it is short.",
    );
    expect(instructions).toContain(
      "Do not over-apply that sparse-reference rule to short self-contained family names.",
    );
  });
});
