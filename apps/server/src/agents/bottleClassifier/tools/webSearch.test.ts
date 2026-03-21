import { describe, expect, test } from "vitest";
import { extractBraveSearchEvidence } from "./braveWebSearch";
import { extractOpenAISearchEvidence } from "./openaiWebSearch";
import { createBottleWebSearchBudget } from "./sharedWebSearch";

describe("bottleClassifier web search tools", () => {
  test("shares one web search budget across providers", () => {
    const budget = createBottleWebSearchBudget(2);

    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.getExhaustedError()).toEqual({
      error: "Search budget exhausted after 2 queries",
    });
  });

  test("extracts provider-aware evidence from OpenAI citations", () => {
    const evidence = extractOpenAISearchEvidence("wild turkey rare breed rye", {
      output_text: "Wild Turkey confirms Rare Breed Rye is barrel proof.",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
                  title: "Rare Breed Rye",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(evidence).toMatchObject({
      provider: "openai",
      query: "wild turkey rare breed rye",
      summary: "Wild Turkey confirms Rare Breed Rye is barrel proof.",
      results: [
        expect.objectContaining({
          domain: "wildturkeybourbon.com",
        }),
      ],
    });
  });

  test("extracts provider-aware evidence from Brave web results", () => {
    const evidence = extractBraveSearchEvidence(
      "glenmorangie quinta ruban 14 barrel proof",
      {
        web: {
          results: [
            {
              title: "The Quinta Ruban 14 Years Old",
              url: "https://www.glenmorangie.com/en-us/products/the-quinta-ruban",
              description: "Official Glenmorangie page for Quinta Ruban 14.",
              extra_snippets: ["Extra-dark finish in ruby port casks."],
            },
          ],
        },
      },
    );

    expect(evidence).toMatchObject({
      provider: "brave",
      query: "glenmorangie quinta ruban 14 barrel proof",
      results: [
        expect.objectContaining({
          domain: "glenmorangie.com",
          extraSnippets: ["Extra-dark finish in ruby port casks."],
        }),
      ],
    });
    expect(evidence.summary).toContain("Official Glenmorangie page");
  });
});
