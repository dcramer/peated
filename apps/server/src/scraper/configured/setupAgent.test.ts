import { load } from "cheerio";
import { expect, test, vi } from "vitest";
import {
  prepareAiPages,
  runScrapeSourceSetupAgent,
  suggestionRequestLimit,
} from "./setupAgent";

function text(
  selector: string,
  operations: {
    match?: string[];
    take?: "first" | "all";
    addStart?: string;
    addEnd?: string;
  } = {},
) {
  return {
    get: "text" as const,
    selector,
    take: operations.take ?? ("first" as const),
    match: operations.match ?? null,
    addStart: operations.addStart ?? null,
    addEnd: operations.addEnd ?? null,
  };
}

function pageField(selector: string) {
  return { try: [text(selector)] };
}

function reviewField(
  selector: string,
  operations: Parameters<typeof text>[1] = {},
) {
  return { try: [{ ...text(selector, operations), from: "review" as const }] };
}

function reviewCandidate(
  nameSelector: string,
  listOptions: {
    item?: string;
    excludeWhen?: { selector: string; match: string[] | null };
  } = {},
) {
  return {
    listPageUrl: "https://example.test/reviews",
    rules: {
      kind: "review" as const,
      articles: {
        document: "html" as const,
        oneArticlePer: listOptions.item ?? "body",
        link: "a.review",
        skipWhen: listOptions.excludeWhen ?? null,
        nextPage: null,
        limit: 25,
      },
      article: {
        canonicalUrl: null,
        title: pageField("h1"),
        publishedDate: {
          try: [
            {
              get: "attribute" as const,
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
          oneReviewPer: "element" as const,
          selector: "article.review",
          contains: null,
          name: reviewField(nameSelector, { match: ["{value} Review"] }),
          reviewer: null,
          tastingNotes: reviewField(".body p", {
            match: ["Nose:{anything}", "Finish:{anything}"],
            take: "all",
          }),
          score: null,
        },
      },
    },
  };
}

function catalogCandidate() {
  return {
    listPageUrl: "https://example.test/whisky",
    rules: {
      kind: "catalog" as const,
      products: {
        oneProductPer: "article.product",
        link: "a[href]",
        skipWhen: null,
        nextPage: null,
        limit: 25,
      },
      product: {
        name: pageField("h1"),
        url: null,
        externalProductId: null,
        imageUrl: null,
        volume: null,
        abv: pageField(".abv"),
        statedAge: null,
        edition: null,
        releaseYear: null,
      },
    },
  };
}

function toolCallResponse<T extends object>(callId: string, candidate: T) {
  return {
    model: "test-setup-model",
    output: [
      {
        type: "function_call" as const,
        call_id: callId,
        name: "check_rules",
        arguments: JSON.stringify(candidate),
      },
    ],
  };
}

test("reserves requests for discovery and three rule checks", () => {
  expect(suggestionRequestLimit(0)).toBe(20);
  expect(suggestionRequestLimit(2)).toBe(22);
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
  ).toBeLessThanOrEqual(200_000);
});

test("keeps links and review facts after a large page header", () => {
  const pages = [
    {
      url: "https://example.test/reviews/one",
      html: `<html><head>
      <script>${"/* page script */".repeat(10_000)}</script>
      <style>${".page { color: black; }".repeat(10_000)}</style>
      <meta name="author" content="Example Writer">
    </head><body>
      <h2>Latest Reviews</h2>
      <ul class="reviews"><li><a href="/reviews/one">Example Bourbon</a></li></ul>
      <article class="review">
        <h1>Example Bourbon</h1>
        <time datetime="2026-08-01T12:00:00Z">August 1</time>
        <div class="body"><p>Review introduction.</p><h2>Score: 8/10</h2></div>
      </article>
    </body></html>`,
    },
  ];
  const [prepared] = prepareAiPages(pages);
  const $ = load(prepared!.html);

  expect(prepared!.url).toBe(pages[0]!.url);
  expect(prepared!.html.length).toBeLessThanOrEqual(75_000);
  expect($("h2 + ul.reviews a").attr("href")).toBe("/reviews/one");
  expect($("article.review > h1").text()).toBe("Example Bourbon");
  expect($("article.review time").attr("datetime")).toBe(
    "2026-08-01T12:00:00Z",
  );
  expect($('meta[name="author"]').attr("content")).toBe("Example Writer");
  expect($("article.review .body h2").text()).toBe("Score: 8/10");
  expect($("article.review .body p").text()).toBe("Review introduction.");
  expect(pages[0]!.html).toContain("/* page script */");
});

test("returns rules only after the rule check passes", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(toolCallResponse("first", reviewCandidate(".bad")))
    .mockResolvedValueOnce(
      toolCallResponse(
        "second",
        reviewCandidate(".bottle-name", {
          item: ".product-card",
          excludeWhen: {
            selector: ".badge",
            match: ["Sold out{anything}"],
          },
        }),
      ),
    );
  const checkRules = vi.fn(async ({ rules }) => {
    if (rules.kind !== "review") throw new Error("Expected review rules.");
    if (
      rules.article.reviews.name.try[0]?.get === "text" &&
      rules.article.reviews.name.try[0].selector === ".bad"
    ) {
      return {
        status: "failed" as const,
        feedback: {
          message: "The proposed rules did not read an article page.",
          issues: [
            {
              field: "article.reviews.name",
              message: "The selector did not find an item name.",
            },
          ],
        },
        inspectedPages: [
          {
            url: "https://example.test/reviews/one",
            html: '<article class="review"><h2 class="bottle-name">North Coast 12</h2></article>',
          },
        ],
      };
    }
    return { status: "passed" as const, checked: "parsed review" };
  });

  const result = await runScrapeSourceSetupAgent({
    conversationId: "scrape_source:1",
    externalSiteRunId: 10,
    kind: "review",
    scrapeSourceId: 1,
    listPages: [
      {
        url: "https://example.test/reviews",
        html: '<a class="review" href="/reviews/one">Review</a>',
      },
    ],
    detailPages: [],
    request,
    checkRules,
  });

  expect(result.checked).toBe("parsed review");
  expect(result.model).toBe("test-setup-model");
  expect(result.rules).toMatchObject({
    kind: "review",
    articles: {
      oneArticlePer: ".product-card",
      skipWhen: { selector: ".badge", match: ["Sold out{anything}"] },
      limit: 25,
    },
    article: {
      reviews: {
        name: {
          try: [
            expect.objectContaining({
              selector: ".bottle-name",
              match: ["{value} Review"],
            }),
          ],
        },
        tastingNotes: {
          try: [
            expect.objectContaining({
              selector: ".body p",
              match: ["Nose:{anything}", "Finish:{anything}"],
              take: "all",
            }),
          ],
        },
      },
    },
  });
  expect(request).toHaveBeenCalledTimes(2);
  const firstRequest = request.mock.calls[0]?.[0];
  expect(firstRequest?.tools).toHaveLength(1);
  expect(firstRequest?.tools[0]).toMatchObject({
    name: "check_rules",
    strict: true,
    parameters: { type: "object" },
  });
  expect(JSON.stringify(firstRequest?.tools[0])).not.toContain('"oneOf"');
  const secondRequest = request.mock.calls[1]?.[0];
  expect(JSON.stringify(secondRequest?.input)).toContain(
    "article.reviews.name",
  );
  expect(JSON.stringify(secondRequest?.input)).toContain("North Coast 12");
  expect(secondRequest?.instructions).toContain(
    "Your work is complete only when check_rules accepts the rules.",
  );
});

test("accepts catalog rules without price or review fields", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(toolCallResponse("catalog", catalogCandidate()));
  const result = await runScrapeSourceSetupAgent({
    conversationId: "scrape_source:2",
    externalSiteRunId: 11,
    kind: "catalog",
    scrapeSourceId: 2,
    listPages: [
      {
        url: "https://example.test/whisky",
        html: '<article class="product"><a href="/whisky/one">One</a></article>',
      },
    ],
    detailPages: [],
    request,
    checkRules: async () => ({
      status: "passed" as const,
      checked: "parsed catalog",
    }),
  });

  expect(result.checked).toBe("parsed catalog");
  expect(result.rules).toMatchObject({
    kind: "catalog",
    product: { name: pageField("h1"), abv: pageField(".abv") },
  });
  expect(request.mock.calls[0]?.[0].instructions).toContain(
    "Catalog sources do not require a review, price, currency, or volume.",
  );
});

test("accepts canonical matching, URL dates, and finite score maps", async () => {
  const base = reviewCandidate("h1");
  const candidate = {
    ...base,
    rules: {
      ...base.rules,
      article: {
        ...base.rules.article,
        canonicalUrl: {
          try: [
            {
              get: "attribute" as const,
              selector: 'link[rel="canonical"]',
              attribute: "href",
              match: ["{value}/"],
              addStart: null,
              addEnd: null,
            },
          ],
        },
        publishedDate: {
          try: [
            {
              get: "dateFromUrl" as const,
              format: "/yyyy/MM/*-MMddyy",
            },
          ],
        },
        reviews: {
          ...base.rules.article.reviews,
          score: {
            try: [
              {
                ...text(".rating", { match: ["Rating: {value}"] }),
                from: "review" as const,
              },
              {
                ...text(".article-rating"),
                from: "article" as const,
                useFor: "firstReview" as const,
              },
            ],
            scale: 100,
            map: [
              { text: "A", value: 95 },
              { text: "B+", value: 87 },
            ],
          },
        },
      },
    },
  };
  const checkRules = vi.fn(async () => ({
    status: "passed" as const,
    checked: "parsed mapped review",
  }));

  const result = await runScrapeSourceSetupAgent({
    conversationId: "scrape_source:1",
    externalSiteRunId: 10,
    kind: "review",
    scrapeSourceId: 1,
    listPages: [
      {
        url: "https://example.test/reviews",
        html: '<a class="review" href="/reviews/one">Review</a>',
      },
    ],
    detailPages: [],
    request: vi.fn().mockResolvedValue(toolCallResponse("mapped", candidate)),
    checkRules,
  });

  expect(result.rules).toMatchObject({
    article: {
      canonicalUrl: {
        try: [
          expect.objectContaining({
            selector: 'link[rel="canonical"]',
            attribute: "href",
            match: ["{value}/"],
          }),
        ],
      },
      publishedDate: {
        try: [{ get: "dateFromUrl", format: "/yyyy/MM/*-MMddyy" }],
      },
      reviews: {
        score: expect.objectContaining({
          scale: 100,
          try: expect.arrayContaining([
            expect.objectContaining({
              from: "article",
              useFor: "firstReview",
              selector: ".article-rating",
            }),
          ]),
          map: [
            { text: "A", value: 95 },
            { text: "B+", value: 87 },
          ],
        }),
      },
    },
  });
  expect(checkRules).toHaveBeenCalledOnce();
});

test("turns review labels into sections", async () => {
  const base = reviewCandidate("h2");
  const candidate = {
    ...base,
    rules: {
      ...base.rules,
      article: {
        ...base.rules.article,
        reviews: {
          inside: ".entry-content",
          oneReviewPer: "section" as const,
          startsAt: {
            selector: "h2.review",
            match: null,
          },
          stopBefore: {
            selector: ".related-posts",
            match: null,
          },
          whenOnlyOneReview: "useWholeArea" as const,
          name: base.rules.article.reviews.name,
          reviewer: base.rules.article.reviews.reviewer,
          tastingNotes: base.rules.article.reviews.tastingNotes,
          score: base.rules.article.reviews.score,
        },
      },
    },
  };

  const request = vi
    .fn()
    .mockResolvedValue(toolCallResponse("sections", candidate));
  const result = await runScrapeSourceSetupAgent({
    conversationId: "scrape_source:1",
    externalSiteRunId: 10,
    kind: "review",
    scrapeSourceId: 1,
    listPages: [
      {
        url: "https://example.test/reviews",
        html: '<a class="review" href="/reviews/one">Review</a>',
      },
    ],
    detailPages: [],
    request,
    checkRules: vi.fn(async () => ({
      status: "passed" as const,
      checked: "parsed sections",
    })),
  });

  expect(result.rules).toMatchObject({
    kind: "review",
    article: {
      reviews: {
        oneReviewPer: "section",
        startsAt: {
          selector: "h2.review",
          match: null,
        },
        stopBefore: {
          selector: ".related-posts",
          match: null,
        },
        whenOnlyOneReview: "useWholeArea",
      },
    },
  });
  expect(request.mock.calls[0]?.[0].instructions).toContain(
    '"Review {anything} - {value}" keeps the writer',
  );
  expect(request.mock.calls[0]?.[0].instructions).not.toContain("startsWith");
});

test("stops after the rule-check limit", async () => {
  const request = vi.fn(async () =>
    toolCallResponse("failed", reviewCandidate(".bad")),
  );

  await expect(
    runScrapeSourceSetupAgent({
      conversationId: "scrape_source:1",
      externalSiteRunId: 10,
      kind: "review",
      scrapeSourceId: 1,
      listPages: [
        { url: "https://example.test/reviews", html: "<main></main>" },
      ],
      detailPages: [],
      request,
      checkRules: async () => ({
        status: "failed" as const,
        feedback: {
          message: "The rules still fail.",
          issues: [
            {
              field: "article.reviews.name",
              message: "No item name was found.",
            },
          ],
        },
        inspectedPages: [],
      }),
    }),
  ).rejects.toThrow("The rules still fail.");
  expect(request).toHaveBeenCalledTimes(3);
});
