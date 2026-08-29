import { expect, test } from "vitest";
import {
  MAX_AI_INPUT_CHARS,
  chooseSuggestedListPage,
  createSuggestionFormat,
  prepareAiPages,
} from "./suggestion";

test("uses object schemas for AI output", () => {
  for (const kind of ["review", "price"] as const) {
    const format = createSuggestionFormat(kind);
    expect(format.schema).toMatchObject({ type: "object" });
    expect(JSON.stringify(format.schema)).not.toContain('"oneOf"');
  }
});

test("bounds total AI input while keeping every sample page", () => {
  const pages = Array.from({ length: 10 }, (_, index) => ({
    url: `https://example.test/${index}`,
    html: "x".repeat(50_000),
  }));
  const prepared = prepareAiPages(pages);

  expect(prepared).toHaveLength(pages.length);
  expect(prepared.every((page) => page.html.length > 0)).toBe(true);
  expect(
    prepared.reduce((total, page) => total + page.html.length, 0),
  ).toBeLessThanOrEqual(MAX_AI_INPUT_CHARS);
});

test("chooses the supplied page with the most matching detail links", () => {
  const listUrl = chooseSuggestedListPage({
    listPageUrl: "https://example.test/reviews",
    rules: {
      kind: "review",
      list: {
        detailLink: { selector: "a.review", attribute: "href" },
        maxItems: 10,
      },
      detail: {
        title: { selector: "h1" },
        reviewItem: "article.review",
        name: { selector: "h2" },
      },
    },
    pages: [
      {
        url: "https://example.test/",
        html: '<a class="review" href="/reviews/one">One</a>',
      },
      {
        url: "https://example.test/reviews",
        html: `
          <a class="review" href="/reviews/one">One</a>
          <a class="review" href="/reviews/two">Two</a>
        `,
      },
    ],
  });

  expect(listUrl).toBe("https://example.test/reviews");
});

test("rejects a list page that was not supplied", () => {
  expect(() =>
    chooseSuggestedListPage({
      listPageUrl: "https://example.test/archive",
      rules: {
        kind: "review",
        list: {
          detailLink: { selector: "a.review", attribute: "href" },
          maxItems: 10,
        },
        detail: {
          title: { selector: "h1" },
          reviewItem: "article.review",
          name: { selector: "h2" },
        },
      },
      pages: [{ url: "https://example.test/", html: "<main></main>" }],
    }),
  ).toThrow("The suggested list page was not supplied to the model.");
});
