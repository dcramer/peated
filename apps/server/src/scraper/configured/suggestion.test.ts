import { expect, test } from "vitest";
import {
  MAX_AI_INPUT_CHARS,
  checkDetailPages,
  checkListPage,
  checkNextListPage,
  checkRuleReview,
  createRuleReviewFormat,
  createSuggestionFormat,
  prepareAiPages,
  suggestionRequestLimit,
} from "./suggestion";

const reviewRules = {
  kind: "review" as const,
  list: {
    detailLink: { selector: "a.review", attribute: "href" },
    maxItems: 10,
  },
  detail: {
    title: { selector: "h1" },
    reviewItem: "article.review",
    name: { selector: "h2" },
    reviewText: { selector: ".body" },
  },
};

test("uses object schemas for AI output", () => {
  for (const kind of ["review", "price"] as const) {
    const format = createSuggestionFormat(kind);
    expect(format.schema).toMatchObject({ type: "object" });
    expect(JSON.stringify(format.schema)).not.toContain('"oneOf"');
  }
  expect(createRuleReviewFormat().schema).toMatchObject({
    type: "object",
  });
});

test("reserves requests for discovery and final page checks", () => {
  expect(suggestionRequestLimit(0)).toBe(12);
  expect(suggestionRequestLimit(2)).toBe(14);
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

test("validates the selected list page and returns its detail links", () => {
  const page = checkListPage({
    listPageUrl: "https://example.test/reviews",
    rules: reviewRules,
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

  expect(page.url).toBe("https://example.test/reviews");
  expect(page.links).toEqual([
    "https://example.test/reviews/one",
    "https://example.test/reviews/two",
  ]);
  expect(page.nextPageUrl).toBeNull();
});

test("checks that pagination adds detail links", async () => {
  const rules = {
    ...reviewRules,
    list: {
      ...reviewRules.list,
      nextPage: { selector: "a.next", attribute: "href" },
    },
  };
  const firstPage = checkListPage({
    listPageUrl: "https://example.test/reviews",
    rules,
    pages: [
      {
        url: "https://example.test/reviews",
        html: '<a class="review" href="/reviews/one">One</a><a class="next" href="/reviews?page=2">Next</a>',
      },
    ],
  });
  const checked = await checkNextListPage({
    rules,
    listPage: firstPage,
    loadPage: async (url) => ({
      url: url.toString(),
      html: '<a class="review" href="/reviews/two">Two</a>',
    }),
  });

  expect(checked.links).toEqual([
    "https://example.test/reviews/one",
    "https://example.test/reviews/two",
  ]);
});

test("rejects a list page that was not supplied", () => {
  expect(() =>
    checkListPage({
      listPageUrl: "https://example.test/archive",
      rules: reviewRules,
      pages: [{ url: "https://example.test/", html: "<main></main>" }],
    }),
  ).toThrow("The suggested list page was not supplied to the model.");
});

test("parses supplied detail pages with the production parser", async () => {
  const page = {
    url: "https://example.test/reviews",
    html: '<a class="review" href="/reviews/one">One</a>',
    links: ["https://example.test/reviews/one"],
    firstPageLinks: ["https://example.test/reviews/one"],
    nextPageUrl: null,
    nextPage: null,
  };
  const detailPages = await checkDetailPages({
    rules: reviewRules,
    listPage: page,
    suppliedPages: [
      {
        url: "https://example.test/reviews/one",
        html: '<h1>Autumn reviews</h1><article class="review"><h2>North Coast 12</h2><p class="body">Orange and oak.</p></article>',
      },
    ],
    loadPage: async () => {
      throw new Error("A supplied detail page must not be fetched again.");
    },
  });

  expect(detailPages).toMatchObject([
    {
      url: "https://example.test/reviews/one",
      output: {
        kind: "review",
        title: "Autumn reviews",
        reviews: [{ name: "North Coast 12", reviewText: "Orange and oak." }],
      },
    },
  ]);
});

test("rejects suggested rules that do not parse a detail page", async () => {
  await expect(
    checkDetailPages({
      rules: reviewRules,
      listPage: {
        url: "https://example.test/reviews",
        html: '<a class="review" href="/reviews/one">One</a>',
        links: ["https://example.test/reviews/one"],
        firstPageLinks: ["https://example.test/reviews/one"],
        nextPageUrl: null,
        nextPage: null,
      },
      suppliedPages: [],
      loadPage: async (url) => ({
        url: url.toString(),
        html: "<main>Unrelated page</main>",
      }),
    }),
  ).rejects.toThrow("The suggested rules did not parse a detail page.");
});

test("requires an AI review with no issues", () => {
  expect(() => checkRuleReview('{"issues":[]}')).not.toThrow();
  expect(() =>
    checkRuleReview(
      '{"issues":[{"field":"name","message":"The name does not match."}]}',
    ),
  ).toThrow("AI review did not confirm the suggested parsing rules.");
});
