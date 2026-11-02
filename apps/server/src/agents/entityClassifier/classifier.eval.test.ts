import {
  createEntityClassifier,
  type SearchEntitiesArgs,
} from "@peated/entity-classifier";
import config from "@peated/server/config";
import { createLanguageModel } from "@peated/server/lib/aiSdkModels";
import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";

import { ENTITY_EVAL_CASES, type EntityEvalCase } from "./evals/cases";

// Reviewed pages only, so a run needs no Firecrawl key and every run sees the
// same evidence (model checks guide, controlled comparisons).
function createSavedWeb({ pages }: EntityEvalCase) {
  return {
    searchWeb: async () => ({
      status: "ok" as const,
      results: pages.map(({ url, title, description }) => ({
        url,
        title,
        description,
      })),
    }),
    readPage: async ({ url }: { url: string }) => {
      const page = pages.find((saved) => saved.url === url);
      if (!page) {
        return {
          status: "failed" as const,
          url,
          reason: "not_found" as const,
          httpStatus: 404,
        };
      }
      return {
        status: "ok" as const,
        url,
        title: page.title,
        description: page.description,
        publishedTime: null,
        content: page.text,
        route: "direct" as const,
      };
    },
  };
}

function classifyCase(evalCase: EntityEvalCase) {
  const classifier = createEntityClassifier({
    languageModel: (model) => createLanguageModel({ model }),
    model: config.OPENAI_MODEL,
    maxSearchQueries: config.ENTITY_CLASSIFIER_MAX_SEARCH_QUERIES,
    web: createSavedWeb(evalCase),
    adapters: {
      searchEntities: async ({ kind }: SearchEntitiesArgs) =>
        evalCase.localEntities.filter((entity) => entity.kind === kind),
    },
  });
  return classifier.classifyEntity({ context: evalCase.context });
}

describe.skipIf(!isAIGatewayConfigured())("Entity classifier", () => {
  test.each(ENTITY_EVAL_CASES.map((evalCase) => [evalCase.name, evalCase]))(
    "%s",
    async (_name, evalCase) => {
      const { advice } = await classifyCase(evalCase);

      expect(evalCase.expected.kinds, advice.summary).toContain(advice.kind);
      if (evalCase.expected.targetEntityId !== undefined) {
        expect(advice.targetEntityId).toBe(evalCase.expected.targetEntityId);
      }
    },
  );
});
