import { expect, test, vi } from "vitest";
import type { ScrapeRules } from "./rules";
import {
  checkDetailPages,
  checkListPage,
  checkNextListPage,
  checkPreviousListPage,
} from "./suggestion";

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
      nextPage: "a.next",
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

test("rejects list rules that drop the working filters", () => {
  const page = checkListPage({
    listPageUrl: "https://example.test/feed.xml",
    rules: {
      ...reviewRules,
      list: { links: "item > link", nextPage: null, limit: 20 },
    },
    pages: [
      {
        url: "https://example.test/feed.xml",
        html: `<rss><channel>
          <item><title>Two malts</title><link>/reviews/malts</link></item>
          <item><title>A few rums</title><link>/reviews/rums</link></item>
        </channel></rss>`,
      },
    ],
  });
  const previousRules = {
    parseList: () => ({
      links: ["https://example.test/reviews/malts"],
      nextPageUrl: null,
      issues: [],
    }),
  };

  expect(() =>
    checkPreviousListPage({ listPage: page, previousRules }),
  ).toThrow("The rules changed which pages the working setup includes.");

  const filteredPage = checkListPage({
    listPageUrl: page.url,
    rules: {
      ...reviewRules,
      list: {
        links: 'item:not(:has(title:contains("rum"))) > link',
        nextPage: null,
        limit: 20,
      },
    },
    pages: [page],
  });
  expect(() =>
    checkPreviousListPage({ listPage: filteredPage, previousRules }),
  ).not.toThrow();
});

test("rejects a list page that was not supplied", () => {
  expect(() =>
    checkListPage({
      listPageUrl: "https://example.test/archive",
      rules: reviewRules,
      pages: [{ url: "https://example.test/", html: "<main></main>" }],
    }),
  ).toThrow("The chosen list page was not one of the given pages.");
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
        html: '<h1>Autumn reviews</h1><time datetime="2026-08-12"></time><article class="review"><h2>North Coast 12</h2><p class="body">Orange and oak.</p></article>',
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

test("checks catalog detail pages without returning publisher prose", async () => {
  const rules = {
    kind: "catalog",
    list: {
      links: "article.product a[href]",
      nextPage: null,
      limit: 10,
    },
    detail: {
      name: "h1",
      url: null,
      id: null,
      image: null,
      volume: null,
      abv: ".abv",
      age: null,
      edition: null,
      year: null,
    },
  } as const satisfies ScrapeRules;
  const detailPages = await checkDetailPages({
    rules,
    listPage: {
      url: "https://example.test/whisky",
      html: '<article class="product"><a href="/whisky/one">One</a></article>',
      links: ["https://example.test/whisky/one"],
      firstPageLinks: ["https://example.test/whisky/one"],
      nextPageUrl: null,
      nextPage: null,
    },
    suppliedPages: [
      {
        url: "https://example.test/whisky/one",
        html: '<h1>Official Release</h1><span class="abv">46%</span><p class="description">Publisher prose.</p>',
      },
    ],
    loadPage: async () => {
      throw new Error("A supplied detail page must not be fetched again.");
    },
  });

  expect(detailPages).toMatchObject([
    {
      output: {
        kind: "catalog",
        products: [
          {
            name: "Official Release",
            sourceBottleIdentity: { abv: 46 },
          },
        ],
      },
    },
  ]);
  expect(JSON.stringify(detailPages.map(({ output }) => output))).not.toContain(
    "Publisher prose",
  );
});

test("keeps complete review text in the checked output", async () => {
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
        html: `<h1>Autumn reviews</h1><time datetime="2026-08-12"></time><article class="review"><h2>North Coast 12</h2><p class="body">${reviewText}</p></article>`,
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
  ).rejects.toThrow("The rules did not read an article or product page.");
});

test("reports a supplied detail page before its rules fail", async () => {
  const checkedPages: string[] = [];
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
      suppliedPages: [
        {
          url: "https://example.test/reviews/one",
          html: "<main>Unrelated page</main>",
        },
      ],
      loadPage: async () => {
        throw new Error("A supplied detail page must not be fetched again.");
      },
      onCheckPage: (page) => checkedPages.push(page.url),
    }),
  ).rejects.toThrow("The rules did not read an article or product page.");
  expect(checkedPages).toEqual(["https://example.test/reviews/one"]);
});

test("checks every detail link selected by the rules", async () => {
  const links = [
    "https://example.test/products/one",
    "https://example.test/products/two",
    "https://example.test/products/three",
    "https://example.test/products/four",
    "https://example.test/products/five",
  ];
  const loadPage = vi.fn(async (url: URL) => ({
    url: url.toString(),
    html: '<h1>Reviews</h1><time datetime="2026-09-01"></time><article class="review"><h2>Whisky</h2><p class="body">Notes.</p></article>',
  }));

  const pages = await checkDetailPages({
    rules: reviewRules,
    listPage: {
      url: "https://example.test/products",
      html: "",
      links,
      firstPageLinks: links,
      nextPageUrl: null,
      nextPage: null,
    },
    suppliedPages: [],
    loadPage,
  });

  expect(pages.map((page) => page.url)).toEqual(links);
  expect(loadPage).toHaveBeenCalledTimes(5);
});
