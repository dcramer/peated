import { describe, expect, test } from "vitest";
import { buildEntityClassifierInstructions } from "./instructions";

describe("entity classifier instructions", () => {
  test("mentions both local and web verification tools when available", () => {
    const instructions = buildEntityClassifierInstructions({
      hasEntitySearch: true,
      hasOpenAIWebSearch: true,
      maxSearchQueries: 4,
    });

    expect(instructions).toContain("search_entities");
    expect(instructions).toContain("openai_web_search");
    expect(instructions).toContain("4 web searches");
  });
});
