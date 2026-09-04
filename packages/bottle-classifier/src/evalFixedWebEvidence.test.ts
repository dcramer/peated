import { describe, expect, test, vi } from "vitest";
import {
  createFixedImageExtractor,
  createFixedWebSearchExecutor,
  parseFixedWebEvidencePack,
} from "./evalFixedWebEvidence";

const officialUrl =
  "https://example.com/products/example-bottle?variant=reviewed";

function fixedEvidence() {
  return parseFixedWebEvidencePack({
    name: "Controlled evidence",
    reviewedAt: "2026-09-03",
    sources: [officialUrl],
    cases: {
      "example-fixture": {
        searchResult: {
          evidence: [
            {
              provider: "firecrawl",
              query: "Reviewed exact Bottle evidence",
              summary: "Reviewed search summary.",
              results: [{ title: "Official Bottle", url: officialUrl }],
            },
          ],
          errors: [],
        },
        pageResults: [
          {
            url: officialUrl,
            result: {
              provider: "firecrawl",
              query: "Reviewed exact Bottle page",
              summary: "Reviewed page summary.",
              results: [{ title: "Official Bottle", url: officialUrl }],
            },
          },
        ],
        imageResults: [
          {
            url: "https://example.com/images/example-bottle.webp",
            result: {
              brand: "Example",
              expression: "Reviewed Bottle",
              abv: 46,
            },
          },
        ],
      },
    },
  }).cases["example-fixture"]!;
}

describe("fixed web evidence", () => {
  test("returns the same reviewed search evidence for different model queries", async () => {
    const execute = vi.fn();
    const executor = createFixedWebSearchExecutor(fixedEvidence());

    const first = await executor({
      toolName: "firecrawl_web_search",
      args: { queries: ["first wording"] },
      execute,
    });
    const second = await executor({
      toolName: "firecrawl_web_search",
      args: { queries: ["different wording"] },
      execute,
    });

    expect(second).toEqual(first);
    expect(execute).not.toHaveBeenCalled();
  });

  test("serves only reviewed pages and never calls live web", async () => {
    const execute = vi.fn();
    const executor = createFixedWebSearchExecutor(fixedEvidence());

    await expect(
      executor({
        toolName: "firecrawl_read_page",
        args: {
          url: `${officialUrl}&utm_source=model`,
          focus: "Exact Bottle identity",
        },
        execute,
      }),
    ).resolves.toMatchObject({ summary: "Reviewed page summary." });
    await expect(
      executor({
        toolName: "firecrawl_read_page",
        args: {
          url: "https://example.com/products/unreviewed",
          focus: "Exact Bottle identity",
        },
        execute,
      }),
    ).resolves.toEqual({
      error:
        "No reviewed fixed page evidence for https://example.com/products/unreviewed.",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  test("returns only the reviewed image extraction", async () => {
    const extract = createFixedImageExtractor(fixedEvidence());

    await expect(
      extract("https://example.com/images/example-bottle.webp?utm_source=eval"),
    ).resolves.toMatchObject({
      brand: "Example",
      expression: "Reviewed Bottle",
      abv: 46,
    });
    await expect(
      extract("https://example.com/images/unreviewed.webp"),
    ).rejects.toThrow(
      "No reviewed fixed image extraction for https://example.com/images/unreviewed.webp.",
    );
  });
});
