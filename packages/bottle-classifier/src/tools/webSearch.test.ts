import { describe, expect, test } from "vitest";
import {
  buildOpenAIWebSearchRequest,
  extractOpenAISearchEvidence,
} from "./openaiWebSearch";
import { buildBottleSearchEvidence } from "./sharedWebSearch";

describe("bottleClassifier web search tools", () => {
  test("extracts OpenAI search evidence from web search call sources when citations are missing", () => {
    const evidence = extractOpenAISearchEvidence(
      "lagavulin distillers edition 2023",
      {
        output: [
          {
            type: "web_search_call",
            action: {
              type: "search",
              query: "lagavulin distillers edition 2023",
              sources: [
                {
                  type: "url",
                  url: "https://www.malts.com/en-row/products/lagavulin-distillers-edition-single-malt-scotch-whisky",
                },
                {
                  type: "url",
                  url: "https://www.whiskyadvocate.com/ratings-reviews/lagavulin-distillers-edition-2023/",
                },
              ],
            },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "OpenAI searched the web and found official plus independent references.",
                annotations: [],
              },
            ],
          },
        ],
      },
    );

    expect(evidence).toMatchObject({
      provider: "openai",
      query: "lagavulin distillers edition 2023",
      summary:
        "OpenAI searched the web and found official plus independent references.",
    });
    expect(evidence.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "malts.com",
          url: "https://www.malts.com/en-row/products/lagavulin-distillers-edition-single-malt-scotch-whisky",
        }),
        expect.objectContaining({
          domain: "whiskyadvocate.com",
          url: "https://www.whiskyadvocate.com/ratings-reviews/lagavulin-distillers-edition-2023/",
        }),
      ]),
    );
  });

  test("prefers citation titles while deduping against OpenAI web search call sources", () => {
    const evidence = extractOpenAISearchEvidence("wild turkey rare breed rye", {
      output_text: "Wild Turkey confirms Rare Breed Rye is barrel proof.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            query: "wild turkey rare breed rye",
            sources: [
              {
                type: "url",
                url: "https://www.wildturkeybourbon.com/products/rare-breed-rye/",
              },
            ],
          },
        },
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

    expect(evidence.results).toEqual([
      expect.objectContaining({
        title: "Rare Breed Rye",
        domain: "wildturkeybourbon.com",
        description: null,
      }),
    ]);
  });

  test("does not duplicate the top-level summary into each OpenAI result description", () => {
    const evidence = extractOpenAISearchEvidence("jura 12 official", {
      output_text: "Jura confirms the 12-year-old core single malt bottling.",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            query: "jura 12 official",
            sources: [
              {
                type: "url",
                url: "https://jurawhisky.com/products/12-year-old",
              },
              {
                type: "url",
                url: "https://www.masterofmalt.com/whiskies/jura/jura-12-year-old-whisky/",
              },
            ],
          },
        },
      ],
    });

    expect(evidence.summary).toBe(
      "Jura confirms the 12-year-old core single malt bottling.",
    );
    expect(evidence.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: null,
        }),
      ]),
    );
  });

  test("caps bottle search evidence payload size", () => {
    const evidence = buildBottleSearchEvidence({
      provider: "brave",
      query: "ardbeg traigh bhan 19",
      summary: "x".repeat(500),
      results: Array.from({ length: 12 }, (_, index) => ({
        title: `Result ${index + 1} ${"y".repeat(300)}`,
        url: `https://example.com/${index + 1}`,
        domain: "example.com",
        description: "z".repeat(400),
        extraSnippets: ["a".repeat(250), "b".repeat(250)],
      })),
    });

    expect(evidence.summary).toHaveLength(320);
    expect(evidence.results).toHaveLength(6);
    for (const result of evidence.results) {
      expect(result.title.length).toBeLessThanOrEqual(160);
      expect((result.description ?? "").length).toBeLessThanOrEqual(220);
      expect(result.extraSnippets.length).toBeLessThanOrEqual(1);
      expect((result.extraSnippets[0] ?? "").length).toBeLessThanOrEqual(180);
    }
  });

  test("requests OpenAI web search sources in the response payload", () => {
    const request = buildOpenAIWebSearchRequest({
      model: "gpt-5.4",
      query: "lagavulin distillers edition 2023",
      instructions: "Search the web.",
    });

    expect(request).toEqual(
      expect.objectContaining({
        include: ["web_search_call.action.sources"],
      }),
    );
  });
});
