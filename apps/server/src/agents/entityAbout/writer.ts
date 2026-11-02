import { agentOutput, runAgent } from "@peated/agent-run";
import config from "@peated/server/config";
import { createLanguageModel } from "@peated/server/lib/aiSdkModels";
import type { AboutPageRead } from "@peated/server/lib/entityAbout/checks";
import { withSentryConversation } from "@peated/server/lib/openaiClient";
import { createServerPeatedBot } from "@peated/server/lib/peatedBot";

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
  createBotSource,
  type AboutWebSource,
} from "./webTools";

const MAX_TURNS = 128;

const AboutDraftOutput = agentOutput("entity_about_draft", AboutDraftSchema);

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

    const result = await withSentryConversation(
      `entity_about:${input.entityId}`,
      () =>
        runAgent({
          model: createLanguageModel({ model: config.OPENAI_MODEL }),
          functionId: "entity_about_writer",
          instructions: ENTITY_ABOUT_INSTRUCTIONS,
          input: buildEntityAboutInput(input),
          tools,
          output: AboutDraftOutput,
          maxTurns: MAX_TURNS,
        }),
    );
    return {
      draft: AboutDraftSchema.parse(result.output),
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
  return createBotSource(
    createServerPeatedBot({ firecrawlApiKey: config.FIRECRAWL_API_KEY }),
  );
});
