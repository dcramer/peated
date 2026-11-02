import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { createEntityClassifier } from "./classifierRuntime";
import type { EntityClassificationAdvice } from "./classifierTypes";
import { EntityClassificationError } from "./error";

const NO_USAGE = {
  inputTokens: {
    total: 0,
    noCache: 0,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

const CONTEXT = {
  entity: {
    id: 42,
    name: "Ardbeg Distillery",
    shortName: null,
    otherNames: [],
    kind: "brand" as const,
    website: null,
    countryName: "Scotland",
    regionName: "Islay",
    totalBottles: 3,
    totalTastings: 12,
  },
  reasons: [
    {
      kind: "manual_audit" as const,
      summary: "Check this row.",
      details: null,
    },
  ],
  sampleBottles: [],
  candidateTargets: [],
};

const SEARCH_RESULT = {
  entityId: 7,
  name: "Ardbeg",
  shortName: null,
  kind: "brand" as const,
  reference: "Ardbeg",
  score: 1,
  source: ["exact" as const],
};

function searchTurn(toolCallId: string) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId,
        toolName: "search_entities",
        input: JSON.stringify({ query: "Ardbeg", kind: "brand", limit: 5 }),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
    usage: NO_USAGE,
    warnings: [],
  };
}

function answerTurn(answer: EntityClassificationAdvice) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(answer) }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: NO_USAGE,
    warnings: [],
  };
}

type DoGenerate = NonNullable<
  ConstructorParameters<typeof MockLanguageModelV4>[0]
>["doGenerate"];

function setup(doGenerate: DoGenerate) {
  const model = new MockLanguageModelV4({ doGenerate });
  const searchEntities = vi.fn(async () => [SEARCH_RESULT]);
  const classifier = createEntityClassifier({
    languageModel: () => model,
    model: "test-model",
    maxSearchQueries: 0,
    web: null,
    adapters: { searchEntities },
  });
  return { classifier, model, searchEntities };
}

describe("createEntityClassifier", () => {
  test("searches local Entities, then returns reviewed advice", async () => {
    let turn = 0;
    const { classifier, searchEntities } = setup(async () => {
      turn += 1;
      return turn === 1
        ? searchTurn("call-1")
        : answerTurn({
            kind: "possible_duplicate",
            summary: "This row looks like the Ardbeg Brand.",
            targetEntityId: 7,
            evidenceUrls: [],
          });
    });

    const result = await classifier.classifyEntity({ context: CONTEXT });

    expect(searchEntities).toHaveBeenCalledWith({
      query: "Ardbeg",
      kind: "brand",
      limit: 5,
    });
    expect(result.advice).toMatchObject({
      kind: "possible_duplicate",
      targetEntityId: 7,
    });
    expect(result.artifacts.resolvedEntities).toEqual([SEARCH_RESULT]);
  });

  test("requires every answer field, including ones with defaults", async () => {
    const { classifier, model } = setup(async () =>
      answerTurn({
        kind: "no_issue",
        summary: "This row looks right.",
        targetEntityId: null,
        evidenceUrls: [],
      }),
    );

    await classifier.classifyEntity({ context: CONTEXT });

    const { schema } = z
      .object({ schema: z.object({ required: z.array(z.string()) }) })
      .parse(model.doGenerateCalls.at(-1)?.responseFormat);
    expect(schema.required).toEqual(
      expect.arrayContaining([
        "kind",
        "summary",
        "targetEntityId",
        "evidenceUrls",
      ]),
    );
  });

  test("fails with the evidence so far when the run never answers", async () => {
    const { classifier } = setup(async () => searchTurn("call-1"));

    const error = await classifier
      .classifyEntity({ context: CONTEXT })
      .catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(EntityClassificationError);
    expect(error).toMatchObject({
      artifacts: { resolvedEntities: [SEARCH_RESULT] },
    });
  });
});
