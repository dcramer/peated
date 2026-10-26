import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import config from "@peated/server/config";
import type { AboutPageRead } from "@peated/server/lib/entityAbout/checks";
import { createOpenAIClient } from "@peated/server/lib/openaiClient";

import { AboutDraftSchema, type AboutDraft } from "./draftSchema";
import { createEntitySearchTool } from "./entitySearch";
import {
  buildEntityAboutInput,
  ENTITY_ABOUT_INSTRUCTIONS,
  type EntityAboutWriterInput,
} from "./instructions";
import {
  ABOUT_WEB_BUDGET,
  createAboutWebTools,
  createFirecrawlSource,
  type AboutWebSource,
} from "./webTools";

const MAX_TURNS = 128;

export type EntityAboutWriterResult = {
  draft: AboutDraft;
  pagesRead: AboutPageRead[];
  /** Entity IDs that search_entities returned in this run. */
  entitiesFound?: number[];
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
    const entitiesFound = new Set<number>();
    const tools = [
      ...createAboutWebTools({
        source: getSource(),
        budget: ABOUT_WEB_BUDGET,
        pagesRead,
      }),
      createEntitySearchTool(entitiesFound),
    ];

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
      entitiesFound: [...entitiesFound],
    };
  };
}

/** One writer run on the live web: one agent with web search, page reading, and Entity search. */
export const runEntityAboutWriter = createEntityAboutWriter(() => {
  if (!config.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }
  return createFirecrawlSource({
    apiKey: config.FIRECRAWL_API_KEY,
    apiUrl: config.FIRECRAWL_API_URL,
  });
});
