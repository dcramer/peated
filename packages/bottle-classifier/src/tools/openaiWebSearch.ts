import { tool } from "@openai/agents";
import type OpenAI from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseIncludable,
} from "openai/resources/responses/responses";
import { z } from "zod";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import { getDeterministicOpenAISettings } from "../openaiModelSettings";
import {
  BottleWebSearchArgsSchema,
  BottleWebSearchErrorSchema,
  buildBottleSearchEvidence,
  compactBottleSearchEvidence,
  getResultDomain,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutionCache,
} from "./sharedWebSearch";

const OPENAI_WEB_SEARCH_RESPONSE_INCLUDES: ResponseIncludable[] = [
  "web_search_call.action.sources",
];

const OpenAIWebSearchToolResultSchema = z.union([
  BottleSearchEvidenceSchema.extend({
    supplementalError: z.string().optional(),
  }),
  BottleWebSearchErrorSchema,
]);

const OpenAIWebSearchToolCachePayloadSchema = z.object({
  emittedEvidence: z.array(BottleSearchEvidenceSchema),
  result: OpenAIWebSearchToolResultSchema,
});

export function extractOpenAISearchEvidence(
  query: string,
  response: any,
): BottleSearchEvidence {
  const outputItems: any[] = Array.isArray(response?.output)
    ? response.output
    : [];
  const messageTexts = outputItems
    .filter((item: any): item is { content?: unknown[]; type: "message" } => {
      return item?.type === "message";
    })
    .flatMap((item: { content?: unknown[] }) =>
      Array.isArray(item.content)
        ? item.content
            .filter(
              (
                content: any,
              ): content is { text?: string; type: "output_text" } =>
                content?.type === "output_text",
            )
            .map((content: { text?: string }) => content.text?.trim())
            .filter((value: string | undefined): value is string =>
              Boolean(value),
            )
        : [],
    );
  const summary =
    response.output_text?.trim().slice(0, 600) ||
    messageTexts.join(" ").trim().slice(0, 600) ||
    null;
  const resultsByUrl = new Map<
    string,
    BottleSearchEvidence["results"][number]
  >();

  const mergeResult = ({
    title,
    url,
  }: {
    title?: string | null;
    url: string | null | undefined;
  }) => {
    if (!url) {
      return;
    }

    const normalizedTitle = title?.trim() || url;
    const existing = resultsByUrl.get(url);
    if (!existing) {
      resultsByUrl.set(url, {
        title: normalizedTitle,
        url,
        domain: getResultDomain(url),
        description: null,
        extraSnippets: [],
      });
      return;
    }

    if (existing.title === existing.url && normalizedTitle !== url) {
      existing.title = normalizedTitle;
    }

    existing.description ??= null;
  };

  for (const item of outputItems) {
    if (item?.type === "message") {
      for (const content of Array.isArray(item.content) ? item.content : []) {
        if (content?.type !== "output_text") {
          continue;
        }

        for (const annotation of Array.isArray(content.annotations)
          ? content.annotations
          : []) {
          if (annotation?.type !== "url_citation") {
            continue;
          }

          mergeResult({
            title: annotation.title,
            url: annotation.url,
          });
        }
      }
      continue;
    }

    if (item?.type !== "web_search_call") {
      continue;
    }

    if (item.action?.type === "search") {
      for (const source of Array.isArray(item.action.sources)
        ? item.action.sources
        : []) {
        if (source?.type !== "url") {
          continue;
        }

        mergeResult({
          url: source.url,
        });
      }
      continue;
    }

    if (
      (item.action?.type === "open_page" ||
        item.action?.type === "find_in_page") &&
      typeof item.action.url === "string"
    ) {
      mergeResult({
        url: item.action.url,
      });
    }
  }

  return buildBottleSearchEvidence({
    provider: "openai",
    query,
    summary,
    results: Array.from(resultsByUrl.values()),
  });
}

export function createOpenAIWebSearchTool({
  client,
  model,
  budget,
  cache,
  onEvidence,
}: {
  client: OpenAI;
  model: string;
  budget: BottleWebSearchBudget;
  cache?: BottleWebSearchExecutionCache;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "openai_web_search",
    description:
      "Search the live web using OpenAI's native web search capability. This is the default web search tool when local bottle and entity search are still ambiguous or conflicting. Use it to validate the bottle or release traits that make a match safe, especially when the source text may have omitted a canonical trait that could bridge a generic reference to a more specific local candidate. Prefer official producer, distillery, bottler, or importer domains first, then critics or publications, and treat retailer pages as weak corroboration. Keep queries narrow. If the returned domains are still thin or weak, decide explicitly whether a follow-up search or `brave_web_search` is worth the remaining budget.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      if (!budget.tryConsume()) {
        return budget.getExhaustedError();
      }

      const runLiveSearch = async () => {
        try {
          const evidence = await runOpenAIWebSearch({
            client,
            model,
            query: args.query,
            instructions:
              "Search the web for authoritative evidence about a spirits bottle reference. Prefer official producer, distillery, bottler, or importer domains first, then critics, reviewers, or publications. Do not treat the originating retailer or source page as decisive proof. Cite 2 or 3 distinct URLs when available, including at least one official source and one independent non-retailer source when the web supports that. In the cited summary, explicitly mention only the bottle or release traits the sources confirm, such as distillery, bottler, cask finish, cask size, cask fill, ABV, age, edition, release year, or whether a number is proof rather than ABV.",
          });

          return {
            emittedEvidence: evidence.results.length > 0 ? [evidence] : [],
            result: evidence,
          };
        } catch (error) {
          return {
            emittedEvidence: [],
            result: {
              error:
                error instanceof Error
                  ? `OpenAI web search failed: ${error.message}`
                  : "OpenAI web search failed",
            },
          };
        }
      };

      const cached = cache
        ? await cache.execute({
            key: {
              toolName: "openai_web_search",
              model,
              query: args.query,
            },
            schema: OpenAIWebSearchToolCachePayloadSchema,
            live: runLiveSearch,
          })
        : await runLiveSearch();
      const emittedEvidence = cached.emittedEvidence.map(
        compactBottleSearchEvidence,
      );
      const evidence =
        "error" in cached.result
          ? cached.result
          : compactBottleSearchEvidence(cached.result);

      for (const emitted of emittedEvidence) {
        onEvidence?.(emitted);
      }

      if ("error" in evidence) {
        return evidence;
      }

      return evidence;
    },
  });
}

export function buildOpenAIWebSearchRequest({
  model,
  query,
  instructions,
  extraContext = null,
}: {
  model: string;
  query: string;
  instructions: string;
  extraContext?: string | null;
}): ResponseCreateParamsNonStreaming {
  return {
    model,
    instructions,
    include: OPENAI_WEB_SEARCH_RESPONSE_INCLUDES,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [query, extraContext].filter(Boolean).join("\n\n"),
          },
        ],
      },
    ],
    tools: [{ type: "web_search" }],
    ...getDeterministicOpenAISettings(model),
  };
}

export async function runOpenAIWebSearch({
  client,
  model,
  query,
  instructions,
  extraContext = null,
}: {
  client: OpenAI;
  model: string;
  query: string;
  instructions: string;
  extraContext?: string | null;
}): Promise<BottleSearchEvidence> {
  const response = await client.responses.create(
    buildOpenAIWebSearchRequest({
      model,
      query,
      instructions,
      extraContext,
    }),
  );

  return extractOpenAISearchEvidence(query, response);
}
