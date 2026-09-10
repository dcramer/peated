import { expect, test } from "vitest";
import { loadExecutableScrapeRules } from "./compatibility";
import type { ScrapeRules } from "./rules";
import { testScrapeRules } from "./suggestion";

const reviewRules = {
  kind: "review",
  list: {
    links: "a.review",
    nextPage: null,
    limit: 10,
  },
  detail: {
    url: null,
    title: "h1",
    date: "time",
    reviews: {
      area: "body",
      item: "article.review",
      name: "h2",
      reviewer: null,
      tastingNotes: ".body",
      score: null,
    },
  },
} as const satisfies ScrapeRules;

const article =
  '<h1>Autumn reviews</h1><time datetime="2026-08-12"></time><article class="review"><h2>North Coast 12</h2><p class="body">Orange and oak.</p></article>';

function testPages(
  pages: Record<string, string>,
  options: Partial<
    Pick<
      Parameters<typeof testScrapeRules>[0],
      "rules" | "failureUrl" | "previousRules" | "previousListPageUrl"
    >
  > = {},
) {
  return testScrapeRules({
    listPageUrl: "https://example.test/reviews",
    rules: reviewRules,
    cursor: null,
    checkpoint: async () => {},
    loadPage: async (url) => {
      const html = pages[url.pathname + url.search];
      if (html === undefined) throw new Error("Unexpected page: " + url);
      return { url: url.toString(), html };
    },
    ...options,
  });
}

test("uses the production crawl to test every selected link and pagination beyond page two", async () => {
  const result = await testPages(
    {
      "/reviews":
        '<a class="review" href="/one">One</a><a class="next" href="/reviews?page=2">Next</a>',
      "/reviews?page=2":
        '<a class="review" href="/two">Two</a><a class="next" href="/reviews?page=3">Next</a>',
      "/reviews?page=3":
        '<a class="review" href="/three">Three</a><a class="review" href="/four">Four</a><a class="review" href="/five">Five</a>',
      "/one": article,
      "/two": article,
      "/three": article,
      "/four": article,
      "/five": article,
    },
    {
      rules: {
        ...reviewRules,
        list: { ...reviewRules.list, nextPage: "a.next" },
      },
    },
  );
  expect(result).toMatchObject({
    status: "passed",
    visitedPages: [
      "https://example.test/reviews",
      "https://example.test/reviews?page=2",
      "https://example.test/reviews?page=3",
      "https://example.test/one",
      "https://example.test/two",
      "https://example.test/three",
      "https://example.test/four",
      "https://example.test/five",
    ],
  });
  if (result.status !== "passed") throw new Error(result.feedback.message);
  expect(result.preview.pages).toHaveLength(5);
  expect(result.preview.pages[0]).toMatchObject({
    title: "Autumn reviews",
    reviews: [{ name: "North Coast 12" }],
  });
});

test("fails when a detail page beyond the second list page is broken", async () => {
  const result = await testPages(
    {
      "/reviews":
        '<a class="review" href="/one">One</a><a class="next" href="/reviews?page=2">Next</a>',
      "/reviews?page=2":
        '<a class="review" href="/two">Two</a><a class="next" href="/reviews?page=3">Next</a>',
      "/reviews?page=3": '<a class="review" href="/legacy">Legacy</a>',
      "/one": article,
      "/two": article,
      "/legacy": "<main>Old page layout</main>",
    },
    {
      rules: {
        ...reviewRules,
        list: { ...reviewRules.list, nextPage: "a.next" },
      },
    },
  );
  expect(result).toMatchObject({
    status: "failed",
    inspectedPages: expect.arrayContaining([
      {
        url: "https://example.test/legacy",
        html: "<main>Old page layout</main>",
      },
    ]),
  });
});

test("returns the failing detail page and parser errors to the agent", async () => {
  const result = await testPages({
    "/reviews": '<a class="review" href="/one">One</a>',
    "/one": "<main>Unrelated page</main>",
  });
  expect(result).toMatchObject({
    status: "failed",
    feedback: {
      issues: expect.arrayContaining([
        expect.objectContaining({ field: "detail.title" }),
      ]),
    },
    inspectedPages: expect.arrayContaining([
      { url: "https://example.test/one", html: "<main>Unrelated page</main>" },
    ]),
  });
});

test("does not pass a repair by excluding the failing page", async () => {
  const result = await testPages(
    { "/reviews": '<a class="review" href="/one">One</a>', "/one": article },
    { failureUrl: "https://example.test/missing" },
  );
  expect(result).toMatchObject({
    status: "failed",
    feedback: {
      message: expect.stringContaining("did not reach the page that failed"),
    },
  });
});

test("rejects pagination loops through the same crawler used for collection", async () => {
  const result = await testPages(
    {
      "/reviews":
        '<a class="review" href="/one">One</a><a class="next" href="/reviews">Again</a>',
    },
    {
      rules: {
        ...reviewRules,
        list: { ...reviewRules.list, nextPage: "a.next" },
      },
    },
  );
  expect(result).toMatchObject({
    status: "failed",
    feedback: { issues: [expect.objectContaining({ field: "list.nextPage" })] },
  });
});

test("rejects empty collection results", async () => {
  expect(
    await testPages({ "/reviews": "<main>No reviews</main>" }),
  ).toMatchObject({ status: "failed" });
});

test("preserves the working list filters", async () => {
  const previousRules = loadExecutableScrapeRules(11, {
    ...reviewRules,
    list: { ...reviewRules.list, links: "a.whisky" },
  });
  const pages = {
    "/reviews":
      '<a class="review whisky" href="/malts">Malts</a><a class="review" href="/rums">Rums</a>',
    "/malts": article,
  };
  const previous = {
    previousRules,
    previousListPageUrl: "https://example.test/reviews",
  };
  expect(await testPages(pages, previous)).toMatchObject({
    status: "failed",
    feedback: { message: expect.stringContaining("changed which pages") },
  });
  expect(
    await testPages(pages, {
      ...previous,
      rules: {
        ...reviewRules,
        list: { ...reviewRules.list, links: "a.whisky" },
      },
    }),
  ).toMatchObject({ status: "passed" });
});

test("returns page evidence but keeps publisher prose out of the saved preview", async () => {
  const text = "Long review sentence. ".repeat(100);
  const html = article.replace("Orange and oak.", text);
  const result = await testPages({
    "/reviews": '<a class="review" href="/one">One</a>',
    "/one": html,
  });
  expect(result.status).toBe("passed");
  if (result.status !== "passed") throw new Error(result.feedback.message);
  expect(
    result.inspectedPages.find((page) => page.url.endsWith("/one"))?.html,
  ).toContain(text.trim());
  expect(JSON.stringify(result.preview)).not.toContain("Long review sentence.");
});
