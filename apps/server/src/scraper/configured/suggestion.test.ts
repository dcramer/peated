import { expect, test } from "vitest";
import {
  buildRuleReviewRequest,
  checkDetailPages,
  checkListPage,
  checkNextListPage,
  checkRuleReview,
  createRuleReviewFormat,
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
  const reviewFormat = createRuleReviewFormat();
  expect(reviewFormat.schema).toMatchObject({
    type: "object",
  });
  expect(JSON.stringify(reviewFormat.schema)).not.toContain('"message"');
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
  ).toThrow("The proposed list page was not one of the supplied pages.");
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

test("keeps complete review text for the AI check", async () => {
  const reviewText = "Long review sentence. ".repeat(100);
  const detailPages = await checkDetailPages({
    rules: reviewRules,
    listPage: {
      url: "https://example.test/reviews",
      html: '<a class="review" href="/reviews/one">One</a>',
      links: ["https://example.test/reviews/one"],
      firstPageLinks: ["https://example.test/reviews/one"],
      nextPageUrl: null,
      nextPage: null,
    },
    suppliedPages: [
      {
        url: "https://example.test/reviews/one",
        html: `<h1>Autumn reviews</h1><article class="review"><h2>North Coast 12</h2><p class="body">${reviewText}</p></article>`,
      },
    ],
    loadPage: async () => {
      throw new Error("A supplied detail page must not be fetched again.");
    },
  });

  expect(detailPages[0]?.output).toMatchObject({
    kind: "review",
    reviews: [{ reviewText: reviewText.trim() }],
  });
});

test("bounds long review evidence sent to the AI check", async () => {
  const reviewText = `START-${"x".repeat(49_990)}-END`;
  const urls = ["one", "two", "three"].map(
    (slug) => `https://example.test/reviews/${slug}`,
  );
  const listPage = {
    url: "https://example.test/reviews",
    html: urls
      .map((url) => `<a class="review" href="${url}">Review</a>`)
      .join(""),
    links: urls,
    firstPageLinks: urls,
    nextPageUrl: null,
    nextPage: null,
  };
  const detailPages = await checkDetailPages({
    rules: reviewRules,
    listPage,
    suppliedPages: urls.map((url, index) => ({
      url,
      html: `<h1>Review ${index + 1}</h1><article class="review"><h2>Bottle ${index + 1}</h2><p class="body">${reviewText}</p></article>`,
    })),
    loadPage: async () => {
      throw new Error("A supplied detail page must not be fetched again.");
    },
  });

  const request = buildRuleReviewRequest({
    kind: "review",
    rules: reviewRules,
    listPage,
    detailPages,
  });

  expect(request.length).toBeLessThanOrEqual(150_000);
  expect(request).toContain('"characters":50000');
  expect(request).toContain("START-");
  expect(request).toContain("-END");
  expect(request).toContain("\\n…\\n");
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
  ).rejects.toThrow("The proposed rules did not read a detail page.");
});

test("requires an AI review with no issues", () => {
  expect(() => checkRuleReview('{"issues":[]}')).not.toThrow();
  expect(() => checkRuleReview('{"issues":[{"field":"detail.name"}]}')).toThrow(
    "The final check found page values that did not match.",
  );
});
