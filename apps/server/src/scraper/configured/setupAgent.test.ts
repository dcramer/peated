import { load } from "cheerio";
import { expect, test, vi } from "vitest";
import {
  preparePagesForSetup,
  runScrapeSourceSetupAgent,
  setupRequestLimit,
} from "./setupAgent";

function reviewRuleCheck(nameSelector: string) {
  return {
    listPageUrl: "https://example.test/reviews",
    rules: {
      kind: "review" as const,
      list: {
        links: "a.review",
        nextPage: null,
        limit: 25,
      },
      detail: {
        url: null,
        title: "h1",
        date: "time",
        reviews: {
          area: "body",
          item: "article.review",
          name: nameSelector,
          reviewer: null,
          tastingNotes: ".body p",
          score: null,
        },
      },
    },
  };
}

function catalogRuleCheck() {
  return {
    listPageUrl: "https://example.test/whisky",
    rules: {
      kind: "catalog" as const,
      list: {
        links: "article.product a[href]",
        nextPage: null,
        limit: 25,
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
    },
  };
}

function toolCallResponse<T extends object>(callId: string, ruleCheck: T) {
  return {
    model: "test-setup-model",
    output: [
      {
        type: "function_call" as const,
        call_id: callId,
        name: "check_rules",
        arguments: JSON.stringify(ruleCheck),
      },
    ],
  };
}

test("reserves requests for discovery and three rule checks", () => {
  expect(setupRequestLimit(0)).toBe(309);
  expect(setupRequestLimit(2)).toBe(311);
});

test("bounds total AI input while keeping every sample page", () => {
  const pages = Array.from({ length: 10 }, (_, index) => ({
    url: `https://example.test/${index}`,
    html: "x".repeat(50_000),
  }));
  const prepared = preparePagesForSetup(pages);

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
  const [prepared] = preparePagesForSetup(pages);
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

test("keeps review facts after abnormally large HTML attributes", () => {
  const oversizedMapName = "Map".repeat(30_000);
  const [prepared] = preparePagesForSetup([
    {
      url: "https://example.test/reviews/one",
      html: `<html><body>
        <map name="${oversizedMapName}"><area href="#reviews"></map>
        <article class="review">
          <h1>Autumn reviews</h1>
          <time datetime="2026-09-08">September 8</time>
          <h2 class="bottle-name">North Coast 12</h2>
          <p>Orange and oak.</p>
        </article>
      </body></html>`,
    },
  ]);
  const $ = load(prepared!.html);

  expect(prepared!.html.length).toBeLessThanOrEqual(75_000);
  expect($("map").attr("name")).toHaveLength(500);
  expect($("article.review .bottle-name").text()).toBe("North Coast 12");
  expect($("article.review time").attr("datetime")).toBe("2026-09-08");
  expect($("article.review p").text()).toBe("Orange and oak.");
});

test("keeps feed links visible to the setup agent", () => {
  const [prepared] = preparePagesForSetup([
    {
      url: "https://example.test/feed.xml",
      document: "xml",
      html: `
        <rss><channel><item>
          <title>Latest whisky reviews</title>
          <link>https://example.test/reviews/latest</link>
        </item></channel></rss>
      `,
    },
  ]);

  expect(prepared).toMatchObject({
    document: "xml",
    url: "https://example.test/feed.xml",
  });
  const $ = load(prepared!.html, { xmlMode: true });
  expect($("item > link").text()).toBe("https://example.test/reviews/latest");
});

test("returns rules only after the rule check passes", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(toolCallResponse("first", reviewRuleCheck(".bad")))
    .mockResolvedValueOnce(
      toolCallResponse("second", reviewRuleCheck(".bottle-name")),
    );
  const checkRules = vi.fn(async ({ rules }) => {
    if (rules.kind !== "review") throw new Error("Expected review rules.");
    if (rules.detail.reviews.name === ".bad") {
      return {
        status: "failed" as const,
        feedback: {
          message: "The rules did not read an article page.",
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
    list: {
      links: "a.review",
      limit: 25,
    },
    detail: {
      reviews: {
        name: ".bottle-name",
        tastingNotes: ".body p",
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
  const toolSchema = JSON.stringify(firstRequest?.tools[0]);
  expect(toolSchema).not.toContain('"oneOf"');
  for (const oldRuleName of [
    "oneReviewPer",
    "oneArticlePer",
    "oneProductPer",
    "addStart",
    "addEnd",
    "dateFromUrl",
    "useFor",
  ]) {
    expect(toolSchema).not.toContain(oldRuleName);
  }
  const secondRequest = request.mock.calls[1]?.[0];
  expect(JSON.stringify(secondRequest?.input)).toContain(
    "article.reviews.name",
  );
  expect(JSON.stringify(secondRequest?.input)).toContain("North Coast 12");
  expect(secondRequest?.instructions).toContain(
    "Your work is complete only when check_rules accepts the rules.",
  );
  expect(secondRequest?.instructions).toContain(
    "Code shares one article-level reviewer across its reviews.",
  );
  expect(secondRequest?.instructions).toContain("Review of {value}");
});

test("gives the agent the active setup as migration evidence", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(toolCallResponse("migrated", reviewRuleCheck("h1")));

  await runScrapeSourceSetupAgent({
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
    previousSetup: {
      listPageUrl: "https://example.test/reviews",
      rulesVersion: 6,
      rules: {
        kind: "review",
        articles: {
          oneArticlePer: "body",
          link: "a.review",
          skipWhen: null,
          nextPage: null,
          limit: 25,
        },
        article: {
          canonicalUrl: null,
          title: {
            try: [
              {
                get: "text",
                selector: "h1",
                take: "first",
                startsWith: null,
                clean: null,
              },
            ],
          },
          publishedDate: {
            try: [
              {
                get: "text",
                selector: "time",
                take: "first",
                startsWith: null,
                clean: null,
              },
            ],
          },
          reviews: {
            inside: "body",
            oneReviewPer: "element",
            selector: "article.review",
            name: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: "h2",
                  take: "first",
                  startsWith: null,
                  clean: null,
                },
              ],
            },
            reviewer: null,
            tastingNotes: null,
            score: null,
          },
        },
      },
      matchedPageUrls: ["https://example.test/reviews/one"],
    },
    request,
    checkRules: async () => ({
      status: "passed" as const,
      checked: "parsed review",
    }),
  });

  const firstRequest = request.mock.calls[0]?.[0];
  expect(firstRequest?.input).toMatchObject([
    {
      role: "user",
      content: expect.stringContaining(
        '"matchedPageUrls":["https://example.test/reviews/one"]',
      ),
    },
  ]);
  expect(firstRequest?.input).toMatchObject([
    {
      content: expect.stringContaining('"rulesVersion":6'),
    },
  ]);
  expect(firstRequest?.input).toMatchObject([
    {
      content: expect.stringContaining('"link":"a.review"'),
    },
  ]);
  expect(firstRequest?.instructions).toContain(
    "preserve the kinds of items its working rules included and excluded",
  );
});

test("accepts catalog rules without price or review fields", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(toolCallResponse("catalog", catalogRuleCheck()));
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
    detail: { name: "h1", abv: ".abv" },
  });
  expect(request.mock.calls[0]?.[0].instructions).toContain(
    "Catalog sources do not require a review, price, currency, or volume.",
  );
});

test("accepts canonical, automatic date, and score selectors", async () => {
  const base = reviewRuleCheck("h1");
  const ruleCheck = {
    ...base,
    rules: {
      ...base.rules,
      detail: {
        ...base.rules.detail,
        url: 'link[rel="canonical"]',
        date: null,
        reviews: {
          ...base.rules.detail.reviews,
          score: {
            selector: ".rating",
            outOf: 100,
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
    request: vi.fn().mockResolvedValue(toolCallResponse("mapped", ruleCheck)),
    checkRules,
  });

  expect(result.rules).toMatchObject({
    detail: {
      url: 'link[rel="canonical"]',
      date: null,
      reviews: {
        score: { selector: ".rating", outOf: 100 },
      },
    },
  });
  expect(checkRules).toHaveBeenCalledOnce();
});

test("uses review names to split unwrapped reviews", async () => {
  const base = reviewRuleCheck("h2");
  const ruleCheck = {
    ...base,
    rules: {
      ...base.rules,
      detail: {
        ...base.rules.detail,
        reviews: {
          ...base.rules.detail.reviews,
          area: ".entry-content",
          item: null,
          name: "h2.review",
        },
      },
    },
  };

  const request = vi
    .fn()
    .mockResolvedValue(toolCallResponse("sections", ruleCheck));
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
    detail: {
      reviews: {
        area: ".entry-content",
        item: null,
        name: "h2.review",
      },
    },
  });
  expect(request.mock.calls[0]?.[0].instructions).toContain(
    "Code trims spaces, makes full URLs, and reads prices, scores, dates, and volumes.",
  );
  expect(request.mock.calls[0]?.[0].instructions).not.toContain("addStart");
});

test("stops after the rule-check limit", async () => {
  const request = vi.fn(async () =>
    toolCallResponse("failed", reviewRuleCheck(".bad")),
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
