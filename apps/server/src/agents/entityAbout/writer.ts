import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import config from "@peated/server/config";
import type { AboutPageRead } from "@peated/server/lib/entityAbout/checks";
import { createOpenAIClient } from "@peated/server/lib/openaiClient";

import { AboutDraftSchema, type AboutDraft } from "./draftSchema";
import {
  buildEntityAboutInput,
  ENTITY_ABOUT_INSTRUCTIONS,
  type EntityAboutWriterInput,
} from "./instructions";
import {
  createAboutWebTools,
  createFirecrawlSource,
  type AboutWebSource,
  type WebBudget,
} from "./webTools";

const MAX_TURNS = 24;
export const ABOUT_WEB_BUDGET: WebBudget = { searches: 6, reads: 8 };

export type EntityAboutWriterResult = {
  draft: AboutDraft;
  pagesRead: AboutPageRead[];
};

export type EntityAboutWriter = (
  input: EntityAboutWriterInput & { entityId: number },
) => Promise<EntityAboutWriterResult>;

/**
 * Builds a writer that searches and reads pages through `getSource`. Model
 * checks pass saved pages; the job uses the live web.
 */
export function createEntityAboutWriter(
  getSource: () => AboutWebSource,
): EntityAboutWriter {
  return async (input) => {
    const pagesRead: AboutPageRead[] = [];
    const tools = createAboutWebTools({
      source: getSource(),
      budget: ABOUT_WEB_BUDGET,
      pagesRead,
    });

    const agent = new Agent({
      name: "entity_about_writer",
      instructions: ENTITY_ABOUT_INSTRUCTIONS,
      model: config.OPENAI_MODEL,
      modelSettings: { parallelToolCalls: false },
      outputType: AboutDraftSchema,
      tools,
    });
    const runner = new Runner({
      tracingDisabled: true,
      modelProvider: new OpenAIProvider({
        openAIClient: createOpenAIClient(),
        useResponses: true,
      }),
      workflowName: "Entity About Writer",
      groupId: `entity_about:${input.entityId}`,
    });

    const result = await runner.run(agent, buildEntityAboutInput(input), {
      maxTurns: MAX_TURNS,
    });
    if (!result.finalOutput)
      throw new Error("The About writer returned nothing.");
    return {
      draft: AboutDraftSchema.parse(result.finalOutput),
      pagesRead,
    };
  };
}

/** One writer run on the live web: one agent with web search and page reading. */
export const runEntityAboutWriter = createEntityAboutWriter(() => {
  if (!config.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }
  return createFirecrawlSource({
    apiKey: config.FIRECRAWL_API_KEY,
    apiUrl: config.FIRECRAWL_API_URL,
  });
});
