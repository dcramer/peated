import { load } from "cheerio";
import { expect, test, vi } from "vitest";
import { SCRAPE_SOURCE_DEFAULT_MAX_ITEMS } from "./rules";
import {
  prepareAiPages,
  runScrapeSourceSetupAgent,
  suggestionRequestLimit,
} from "./setupAgent";

function suggestedValue(
  selector: string,
  attribute: string | null = null,
  operations: {
    startsWith?: string[];
    all?: boolean;
    removePrefixes?: string[];
    removeSuffixes?: string[];
    prefix?: string;
    suffix?: string;
  } = {},
) {
  return {
    input: "selector" as const,
    selector,
    attribute,
    value: null,
    startsWith: operations.startsWith ?? null,
    all: operations.all ?? false,
    removePrefixes: operations.removePrefixes ?? null,
    removeSuffixes: operations.removeSuffixes ?? null,
    prefix: operations.prefix ?? null,
    suffix: operations.suffix ?? null,
  };
}

function reviewCandidate(
  nameSelector: string,
  listOptions: {
    item?: string;
    excludeWhen?: { selector: string; startsWith: string[] | null };
  } = {},
) {
  return {
    listPageUrl: "https://example.test/reviews",
    rules: {
      kind: "review" as const,
      list: {
        item: listOptions.item ?? null,
        detailLink: { selector: "a.review", attribute: "href" as const },
        excludeWhen: listOptions.excludeWhen ?? null,
        nextPage: null,
      },
      detail: {
        title: suggestedValue("h1"),
        publishedAt: suggestedValue("time", "datetime"),
        reviewItem: "article.review",
        name: suggestedValue(nameSelector, null, {
          removeSuffixes: ["Review"],
        }),
        reviewerName: null,
        reviewText: suggestedValue(".body p", null, {
          startsWith: ["Nose:", "Finish:"],
          all: true,
        }),
        score: null,
      },
    },
  };
}

function toolCallResponse(
  callId: string,
  candidate: ReturnType<typeof reviewCandidate>,
) {
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
          excludeWhen: { selector: ".badge", startsWith: ["Sold out"] },
        }),
      ),
    );
  const checkRules = vi.fn(async ({ rules }) => {
    if (rules.kind !== "review") throw new Error("Expected review rules.");
    if (
      "selector" in rules.detail.name &&
      rules.detail.name.selector === ".bad"
    ) {
      return {
        status: "failed" as const,
        feedback: {
          message: "The proposed rules did not read a detail page.",
          issues: [
            {
              field: "detail.name",
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
      item: ".product-card",
      excludeWhen: { selector: ".badge", startsWith: ["Sold out"] },
      maxItems: SCRAPE_SOURCE_DEFAULT_MAX_ITEMS,
    },
    detail: {
      name: { selector: ".bottle-name", removeSuffixes: ["Review"] },
      reviewText: {
        selector: ".body p",
        startsWith: ["Nose:", "Finish:"],
        all: true,
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
  expect(JSON.stringify(secondRequest?.input)).toContain("detail.name");
  expect(JSON.stringify(secondRequest?.input)).toContain("North Coast 12");
  expect(secondRequest?.instructions).toContain(
    "Your work is complete only when check_rules accepts the rules.",
  );
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
            { field: "detail.name", message: "No item name was found." },
          ],
        },
        inspectedPages: [],
      }),
    }),
  ).rejects.toThrow("The rules still fail.");
  expect(request).toHaveBeenCalledTimes(3);
});
