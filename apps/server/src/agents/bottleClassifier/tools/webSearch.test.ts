import { describe, expect, test } from "vitest";
import { extractBraveSearchEvidence } from "./braveWebSearch";
import { extractOpenAISearchEvidence } from "./openaiWebSearch";
import {
  createBottleWebSearchBudget,
  isThinBottleSearchEvidence,
  mergeBottleSearchEvidence,
} from "./sharedWebSearch";

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

  test("treats a single cited domain as thin evidence", () => {
    const evidence = extractOpenAISearchEvidence("four roses obso 115.6", {
      output_text: "Four Roses lists barrel strength details.",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://www.fourrosesbourbon.com/bourbon/single-barrel-barrel-strength/",
                  title: "Four Roses Single Barrel Barrel Strength",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(isThinBottleSearchEvidence(evidence)).toBe(true);
  });

  test("merges evidence across passes with deduped urls", () => {
    const openaiEvidence = extractOpenAISearchEvidence(
      "four roses obso 115.6",
      {
        output_text: "Four Roses confirms OBSO barrel strength releases.",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                annotations: [
                  {
                    type: "url_citation",
                    url: "https://www.fourrosesbourbon.com/bourbon/single-barrel-barrel-strength/",
                    title: "Four Roses Single Barrel Barrel Strength",
                  },
                ],
              },
            ],
          },
        ],
      },
    );
    const braveEvidence = extractBraveSearchEvidence("four roses obso 115.6", {
      web: {
        results: [
          {
            title: "Four Roses Private Selection Guide",
            url: "https://www.breakingbourbon.com/review/four-roses-single-barrel-barrel-strength-private-selection",
            description:
              "Breaking Bourbon reviews Four Roses barrel strength picks.",
            extra_snippets: [
              "Includes recipe codes such as OBSO and proof details.",
            ],
          },
          {
            title: "Four Roses Single Barrel Barrel Strength",
            url: "https://www.fourrosesbourbon.com/bourbon/single-barrel-barrel-strength/",
            description: "Official Four Roses page.",
            extra_snippets: [],
          },
        ],
      },
    });

    const mergedEvidence = mergeBottleSearchEvidence({
      provider: "openai",
      query: "four roses obso 115.6",
      evidences: [openaiEvidence, braveEvidence],
    });

    expect(mergedEvidence.results).toHaveLength(2);
    expect(mergedEvidence.summary).toContain("Four Roses confirms OBSO");
    expect(mergedEvidence.summary).toContain("Breaking Bourbon reviews");
    expect(isThinBottleSearchEvidence(mergedEvidence)).toBe(false);
  });
});
