import { load } from "cheerio";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import type { ScrapeRules } from "./rules";
import {
  preparePagesForSetup,
  runScrapeSourceSetupAgent,
  setupRequestLimit,
  type SetupAgentModelRequest,
  type SetupAgentModelResponse,
} from "./setupAgent";
import { testScrapeRules } from "./suggestion";

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
        name: "test_rules",
        arguments: JSON.stringify(ruleCheck),
      },
    ],
  };
}

test("reserves requests for discovery and three rule checks", () => {
  expect(setupRequestLimit(0)).toBe(325);
  expect(setupRequestLimit(2)).toBe(327);
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

function finishResponse(args = {}) {
  return {
    model: "test-setup-model",
    output: [
      {
        type: "function_call" as const,
        name: "finish",
        call_id: "finish",
        arguments: JSON.stringify(args),
      },
    ],
  };
}

const listPage = {
  url: "https://example.test/reviews",
  html: '<a class="review" href="/reviews/one">Review</a>',
};
const article =
  '<h1>Autumn reviews</h1><time datetime="2026-08-12"></time><article class="review"><h2 class="bottle-name">North Coast 12</h2><div class="body"><p>Orange and oak.</p></div></article>';

function runAgentWithPages(
  request: (input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>,
  options: {
    rules?: ScrapeRules;
    html?: string;
    loadPage?: Parameters<typeof testScrapeRules>[0]["loadPage"];
    previousSetup?: Parameters<
      typeof runScrapeSourceSetupAgent
    >[0]["previousSetup"];
  } = {},
) {
  const rules = options.rules ?? reviewRuleCheck(".bottle-name").rules;
  const loadPage =
    options.loadPage ??
    (async (url: URL) => ({
      url: url.toString(),
      html:
        url.pathname === "/reviews" ||
        url.pathname === "/archive" ||
        url.pathname === "/whisky"
          ? rules.kind === "catalog"
            ? '<article class="product"><a href="/whisky/one">One</a></article>'
            : listPage.html
          : (options.html ?? article),
    }));
  return runScrapeSourceSetupAgent({
    conversationId: "scrape_source:1",
    externalSiteRunId: 10,
    kind: rules.kind,
    collectionLimit: rules.list.limit,
    scrapeSourceId: 1,
    listPages: [listPage],
    detailPages: [],
    request,
    previousSetup: options.previousSetup,
    saveState: async () => {},
    readPage: loadPage,
    testRules: async (submitted, cursor, checkpoint) =>
      testScrapeRules({ ...submitted, cursor, checkpoint, loadPage }),
  });
}

test("returns parser failures and successful extractions before accepting the exact tested rules", async () => {
  const good = reviewRuleCheck(".bottle-name");
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(toolCallResponse("bad", reviewRuleCheck(".bad")))
    .mockResolvedValueOnce(toolCallResponse("good", good))
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request);
  expect(result.rules).toEqual(good.rules);
  expect(result.preview.pages).toMatchObject([
    { reviews: [{ name: "North Coast 12" }] },
  ]);
  expect(request).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(request.mock.calls[1]?.[0].input)).toContain(
    "detail.reviews.name",
  );
  expect(JSON.stringify(request.mock.calls[2]?.[0].input)).toContain(
    "North Coast 12",
  );
  expect(request.mock.calls[0]?.[0].tools).toMatchObject([
    { name: "test_rules", strict: true },
    { name: "read_page", strict: true },
    { name: "finish", strict: true },
  ]);
  const toolSchema = JSON.stringify(request.mock.calls[0]?.[0].tools);
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
});

test("lets the agent correct parseable but wrong results before finishing", async () => {
  const wrong = reviewRuleCheck(".body");
  const correct = reviewRuleCheck(".bottle-name");
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(toolCallResponse("wrong", wrong))
    .mockImplementationOnce(async (input) => {
      const { output } = z
        .object({ output: z.string() })
        .parse(input.input.at(-1));
      expect(JSON.parse(output)).toMatchObject({ status: "passed" });
      expect(JSON.stringify(input.input)).toContain("Orange and oak.");
      return toolCallResponse("correct", correct);
    })
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request);
  expect(result.rules).toEqual(correct.rules);
  expect(result.preview.pages).toMatchObject([
    { reviews: [{ name: "North Coast 12" }] },
  ]);
});

test("rejects finishing without a passing test or changing rules while finishing", async () => {
  const checked = reviewRuleCheck(".bottle-name");
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(finishResponse())
    .mockResolvedValueOnce(toolCallResponse("checked", checked))
    .mockResolvedValueOnce(
      finishResponse({ rules: reviewRuleCheck(".bad").rules }),
    )
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request);
  expect(JSON.stringify(request.mock.calls[1]?.[0].input)).toContain(
    "before finishing",
  );
  expect(JSON.stringify(request.mock.calls[3]?.[0].input)).toContain("failed");
  expect(result.rules).toEqual(checked.rules);
});

test("returns feedback for multiple tool calls without testing or accepting unseen results", async () => {
  const checked = reviewRuleCheck(".bottle-name");
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce({
      model: "test-setup-model",
      output: [
        ...toolCallResponse("batch-test", checked).output,
        ...finishResponse().output,
      ],
    })
    .mockResolvedValueOnce(finishResponse())
    .mockResolvedValueOnce(toolCallResponse("checked", checked))
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request);
  const feedback = request.mock.calls[1]![0].input.filter(
    (item) => "type" in item && item.type === "function_call_output",
  );
  expect(feedback).toHaveLength(2);
  for (const item of feedback) {
    expect(JSON.parse(z.string().parse(item.output))).toMatchObject({
      status: "failed",
    });
  }
  expect(JSON.stringify(request.mock.calls[2]![0].input)).toContain(
    "before finishing",
  );
  expect(result.rules).toEqual(checked.rules);
  expect(result.preview.pages).toMatchObject([
    { reviews: [{ name: "North Coast 12" }] },
  ]);
});

test("can inspect and test a collection page outside the initial examples", async () => {
  const checked = {
    ...reviewRuleCheck(".bottle-name"),
    listPageUrl: "https://example.test/archive",
  };
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce({
      model: "test-setup-model",
      output: [
        {
          type: "function_call",
          name: "read_page",
          call_id: "read",
          arguments: JSON.stringify({ url: checked.listPageUrl }),
        },
      ],
    })
    .mockImplementationOnce(async (input) => {
      expect(JSON.stringify(input.input)).toContain("/reviews/one");
      return toolCallResponse("checked", checked);
    })
    .mockResolvedValueOnce(finishResponse());
  expect((await runAgentWithPages(request)).listPageUrl).toBe(
    checked.listPageUrl,
  );
});

test("gives the agent saved rules and previous matches", async () => {
  const checked = reviewRuleCheck(".bottle-name");
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(toolCallResponse("checked", checked))
    .mockResolvedValueOnce(finishResponse());
  await runAgentWithPages(request, {
    previousSetup: {
      listPageUrl: listPage.url,
      rulesVersion: 11,
      rules: checked.rules,
      matchedPageUrls: ["https://example.test/reviews/one"],
    },
  });
  expect(JSON.stringify(request.mock.calls[0]?.[0].input)).toContain(
    "matchedPageUrls",
  );
  expect(JSON.stringify(request.mock.calls[0]?.[0].input)).toContain(
    "/reviews/one",
  );
});

test("tests catalog rules without price fields or saved publisher prose", async () => {
  const checked = catalogRuleCheck();
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(toolCallResponse("catalog", checked))
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request, {
    rules: checked.rules,
    html: '<h1>Official Release</h1><span class="abv">46%</span><p>Publisher prose.</p>',
  });
  expect(result.rules).toEqual(checked.rules);
  expect(result.preview.pages).toMatchObject([
    {
      kind: "catalog",
      products: [
        { name: "Official Release", sourceBottleIdentity: { abv: 46 } },
      ],
    },
  ]);
  expect(JSON.stringify(result.preview)).not.toContain("Publisher prose");
});

test("tests canonical, automatic date, and score selectors", async () => {
  const base = reviewRuleCheck(".bottle-name");
  const checked = {
    ...base,
    rules: {
      ...base.rules,
      detail: {
        ...base.rules.detail,
        url: 'link[rel="canonical"]',
        date: null,
        reviews: {
          ...base.rules.detail.reviews,
          score: { selector: ".rating", outOf: 100 },
        },
      },
    },
  };
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(toolCallResponse("checked", checked))
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request, {
    html:
      article.replace(
        "</article>",
        '<span class="rating">88</span></article>',
      ) + '<link rel="canonical" href="https://example.test/reviews/one">',
  });
  expect(result.rules).toEqual(checked.rules);
  expect(result.preview.pages).toMatchObject([
    { reviews: [{ nativeScore: { value: 88, scale: 100 } }] },
  ]);
});

test("tests unwrapped reviews using name boundaries", async () => {
  const base = reviewRuleCheck(".bottle-name");
  const checked = {
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
          tastingNotes: null,
        },
      },
    },
  };
  const request = vi
    .fn<(input: SetupAgentModelRequest) => Promise<SetupAgentModelResponse>>()
    .mockResolvedValueOnce(toolCallResponse("checked", checked))
    .mockResolvedValueOnce(finishResponse());
  const result = await runAgentWithPages(request, {
    html: '<h1>Reviews</h1><time datetime="2026-08-12"></time><div class="entry-content"><h2 class="review">Coastal Malt</h2><p>Smoke.</p><h2 class="review">Island Malt</h2><p>Salt.</p></div>',
  });
  expect(result.preview.pages).toMatchObject([
    { reviews: [{ name: "Coastal Malt" }, { name: "Island Malt" }] },
  ]);
});

test("does not send unexpected tool failures back to the model as invalid arguments", async () => {
  const request = vi.fn(async () =>
    toolCallResponse("checked", reviewRuleCheck(".bottle-name")),
  );
  const error = new SyntaxError("The page loader failed unexpectedly.");
  await expect(
    runAgentWithPages(request, {
      loadPage: async () => {
        throw error;
      },
    }),
  ).rejects.toBe(error);
  expect(request).toHaveBeenCalledTimes(1);
});

test("stops after three failed rule tests", async () => {
  const request = vi.fn(async () =>
    toolCallResponse("bad", reviewRuleCheck(".bad")),
  );
  await expect(runAgentWithPages(request)).rejects.toThrow("rule test limit");
  expect(request).toHaveBeenCalledTimes(3);
});

test("stops a model that never submits tested rules", async () => {
  const request = vi.fn(async () => finishResponse());
  await expect(runAgentWithPages(request)).rejects.toThrow("model call limit");
  expect(request).toHaveBeenCalledTimes(8);
});
