import { expect, test } from "vitest";
import type { ScrapeRules } from "./rules";
import {
  checkDetailPages,
  checkListPage,
  checkNextListPage,
} from "./suggestion";

const reviewRules = {
  kind: "review",
  articles: {
    document: "html",
    oneArticlePer: "body",
    link: "a.review",
    skipWhen: null,
    nextPage: null,
    limit: 10,
  },
  article: {
    canonicalUrl: null,
    title: {
      try: [
        {
          get: "text",
          selector: "h1",
          take: "first",
          match: null,
          addStart: null,
          addEnd: null,
        },
      ],
    },
    publishedDate: {
      try: [
        {
          get: "attribute",
          selector: "time",
          attribute: "datetime",
          match: null,
          addStart: null,
          addEnd: null,
        },
      ],
    },
    reviews: {
      inside: "body",
      oneReviewPer: "element",
      selector: "article.review",
      contains: null,
      name: {
        try: [
          {
            get: "text",
            from: "review",
            selector: "h2",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
      reviewer: null,
      tastingNotes: {
        try: [
          {
            get: "text",
            from: "review",
            selector: ".body",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
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
    articles: {
      ...reviewRules.articles,
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
  const textField = (selector: string) => ({
    try: [
      {
        get: "text" as const,
        selector,
        take: "first" as const,
        match: null,
        addStart: null,
        addEnd: null,
      },
    ],
  });
  const rules = {
    kind: "catalog",
    products: {
      oneProductPer: "article.product",
      link: "a[href]",
      skipWhen: null,
      nextPage: null,
      limit: 10,
    },
    product: {
      name: textField("h1"),
      url: null,
      externalProductId: null,
      imageUrl: null,
      volume: null,
      abv: textField(".abv"),
      statedAge: null,
      edition: null,
      releaseYear: null,
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
  ).rejects.toThrow(
    "The proposed rules did not read an article or product page.",
  );
});
