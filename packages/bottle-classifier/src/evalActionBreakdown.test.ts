import { describe, expect, test } from "vitest";
import {
  createEvalActionBreakdown,
  formatEvalActionBreakdown,
  recordEvalAction,
} from "./evalActionBreakdown";

describe("eval action breakdown", () => {
  test("separates false no-match results from false-positive acceptance", () => {
    const breakdown = createEvalActionBreakdown();

    recordEvalAction(breakdown, "match", "no_match");
    recordEvalAction(breakdown, "create_bottle", "no_match");
    recordEvalAction(breakdown, "no_match", "match");
    recordEvalAction(breakdown, "ignored", "create_bottle");
    recordEvalAction(breakdown, "match", "match");

    expect(formatEvalActionBreakdown(breakdown)).toBe(
      [
        "Classifier action confusion",
        "",
        "Compared cases with an explicit expected action: 5",
        "False no_match results: 2",
        "False-positive accepted results: 2",
        "",
        "| Expected \\ Actual | match | create_bottle | no_match | ignored |",
        "| --- | ---: | ---: | ---: | ---: |",
        "| match | 1 | 0 | 1 | 0 |",
        "| create_bottle | 0 | 0 | 1 | 0 |",
        "| no_match | 1 | 0 | 0 | 0 |",
        "| ignored | 0 | 1 | 0 | 0 |",
      ].join("\n"),
    );
  });

  test("omits an empty breakdown", () => {
    expect(formatEvalActionBreakdown(createEvalActionBreakdown())).toBeNull();
  });
});
