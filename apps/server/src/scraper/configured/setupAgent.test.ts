import { expect, test, vi } from "vitest";
import { SCRAPE_SOURCE_DEFAULT_MAX_ITEMS } from "./rules";
import {
  MAX_AI_INPUT_CHARS,
  MAX_RULE_CHECKS,
  createCheckRulesTool,
  prepareAiPages,
  runScrapeSourceSetupAgent,
  type SetupAgentModelResponse,
} from "./setupAgent";

function reviewCandidate(nameSelector: string) {
  return {
    listPageUrl: "https://example.test/reviews",
    rules: {
      kind: "review" as const,
      list: {
        detailLink: { selector: "a.review", attribute: "href" as const },
        nextPage: null,
      },
      detail: {
        title: { selector: "h1", attribute: null },
        publishedAt: null,
        reviewItem: "article.review",
        name: { selector: nameSelector, attribute: null },
        reviewerName: null,
        reviewText: { selector: ".body", attribute: null },
        score: null,
      },
    },
  };
}

function toolCallResponse(
  callId: string,
  candidate: ReturnType<typeof reviewCandidate>,
): SetupAgentModelResponse {
  return {
    model: "test-setup-model",
    output: [
      {
        type: "function_call",
        call_id: callId,
        name: "check_rules",
        arguments: JSON.stringify(candidate),
      },
    ],
  };
}

test("gives the setup agent one strict rule-check tool", () => {
  const tool = createCheckRulesTool("review");
  expect(tool).toMatchObject({
    name: "check_rules",
    strict: true,
    parameters: { type: "object" },
  });
  expect(JSON.stringify(tool.parameters)).not.toContain('"oneOf"');
  expect(JSON.stringify(tool.parameters)).not.toContain('"maxItems"');
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

test("returns rules only after the rule check passes", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(toolCallResponse("first", reviewCandidate(".bad")))
    .mockResolvedValueOnce(
      toolCallResponse("second", reviewCandidate(".bottle-name")),
    );
  const checkRules = vi.fn(async ({ rules }) => {
    if (rules.kind !== "review") throw new Error("Expected review rules.");
    if (rules.detail.name.selector === ".bad") {
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
    kind: "review",
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
    list: { maxItems: SCRAPE_SOURCE_DEFAULT_MAX_ITEMS },
    detail: { name: { selector: ".bottle-name" } },
  });
  expect(request).toHaveBeenCalledTimes(2);
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
      kind: "review",
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
  expect(request).toHaveBeenCalledTimes(MAX_RULE_CHECKS);
});
