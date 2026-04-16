import { describe, expect, test } from "vitest";
import {
  buildOpenAIWebSearchRequest,
  extractOpenAISearchEvidence,
} from "./openaiWebSearch";

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
      }),
    ]);
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
