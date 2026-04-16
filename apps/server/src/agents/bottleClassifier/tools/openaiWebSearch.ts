import { tool } from "@openai/agents";
import config from "@peated/server/config";
import type OpenAI from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseIncludable,
} from "openai/resources/responses/responses";
import type { BottleSearchEvidence } from "../schemas";
import { runBraveWebSearch } from "./braveWebSearch";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  getDistinctResultDomains,
  getResultDomain,
  isThinBottleSearchEvidence,
  mergeBottleSearchEvidence,
  mergeBottleSearchResults,
  summarizeSearchResults,
  type BottleWebSearchBudget,
} from "./sharedWebSearch";

const OPENAI_WEB_SEARCH_RESPONSE_INCLUDES: ResponseIncludable[] = [
  "web_search_call.action.sources",
];

function getDeterministicOpenAISettings(model: string): {
  temperature?: number;
} {
  return model.toLowerCase().startsWith("gpt-5") ? {} : { temperature: 0 };
}

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
        description: summary,
        extraSnippets: [],
      });
      return;
    }

    if (existing.title === existing.url && normalizedTitle !== url) {
      existing.title = normalizedTitle;
    }

    existing.description ??= summary;
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
  budget,
  braveApiKey,
  onEvidence,
}: {
  client: OpenAI;
  budget: BottleWebSearchBudget;
  braveApiKey?: string | null;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "openai_web_search",
    description:
      "Search the live web using OpenAI's native web search capability. This is the default web search tool when local bottle and entity search are still ambiguous or conflicting. Use it to validate the bottle or release traits that make a match safe, especially when the source text may have omitted a canonical trait that could bridge a generic reference to a more specific local candidate. Prefer official producer, distillery, bottler, or importer domains first, then critics or publications, and treat retailer pages as weak corroboration. When the first search is thin, this tool will automatically try to gather additional non-retailer evidence.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      if (!budget.tryConsume()) {
        return budget.getExhaustedError();
      }

      try {
        const primaryEvidence = await runOpenAIWebSearch({
          client,
          query: args.query,
          instructions:
            "Search the web for authoritative evidence about a spirits bottle reference. Prefer official producer, distillery, bottler, or importer domains first, then critics, reviewers, or publications. Do not treat the originating retailer or source page as decisive proof. Cite 2 to 4 distinct URLs when available, including at least one official source and one independent non-retailer source when the web supports that. In the cited summary, explicitly mention which bottle or release traits the sources confirm, such as distillery, bottler, cask finish, cask size, cask fill, ABV, age, edition, release year, or whether a number is proof rather than ABV.",
        });
        const openAIEvidences = [primaryEvidence];

        if (
          isThinBottleSearchEvidence(primaryEvidence) &&
          budget.tryConsume()
        ) {
          const citedDomains = getDistinctResultDomains(
            primaryEvidence.results,
          );
          let supplementalEvidence: BottleSearchEvidence | null = null;
          try {
            supplementalEvidence = await runOpenAIWebSearch({
              client,
              query: args.query,
              instructions:
                "Search the web for additional corroborating sources about the same spirits bottle reference. Prefer domains different from the first pass, especially official producer, distillery, bottler, or importer pages if missing, otherwise independent reviewers, critics, or publications. Avoid retailer-only evidence when possible. Explicitly call out whether the sources confirm proof-style labeling, barrel strength, or a concrete ABV.",
              extraContext:
                citedDomains.length > 0
                  ? `Previously cited domains: ${citedDomains.join(", ")}. Find different domains if possible.`
                  : null,
            });
          } catch {
            supplementalEvidence = null;
          }

          if (supplementalEvidence?.results.length) {
            openAIEvidences.push(supplementalEvidence);
          }
        }

        const openAIEvidence =
          openAIEvidences.length > 1
            ? mergeBottleSearchEvidence({
                provider: "openai",
                query: args.query,
                evidences: openAIEvidences,
              })
            : primaryEvidence;

        if (openAIEvidence.results.length > 0) {
          onEvidence?.(openAIEvidence);
        }

        if (
          braveApiKey &&
          isThinBottleSearchEvidence(openAIEvidence) &&
          budget.tryConsume()
        ) {
          const braveEvidence = await runBraveWebSearch({
            apiKey: braveApiKey,
            query: args.query,
          });

          if ("error" in braveEvidence) {
            return {
              ...openAIEvidence,
              supplementalError: braveEvidence.error,
            };
          }

          if (braveEvidence.results.length > 0) {
            onEvidence?.(braveEvidence);
          }

          const mergedResults = mergeBottleSearchResults(
            openAIEvidence.results,
            braveEvidence.results,
          );

          return buildBottleSearchEvidence({
            provider: "openai",
            query: args.query,
            summary:
              summarizeSearchResults(mergedResults) ?? openAIEvidence.summary,
            results: mergedResults,
          });
        }

        return openAIEvidence;
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? `OpenAI web search failed: ${error.message}`
              : "OpenAI web search failed",
        };
      }
    },
  });
}

export function buildOpenAIWebSearchRequest({
  query,
  instructions,
  extraContext = null,
}: {
  query: string;
  instructions: string;
  extraContext?: string | null;
}): ResponseCreateParamsNonStreaming {
  return {
    model: config.OPENAI_MODEL,
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
    ...getDeterministicOpenAISettings(config.OPENAI_MODEL),
  };
}

async function runOpenAIWebSearch({
  client,
  query,
  instructions,
  extraContext = null,
}: {
  client: OpenAI;
  query: string;
  instructions: string;
  extraContext?: string | null;
}): Promise<BottleSearchEvidence> {
  const response = await client.responses.create(
    buildOpenAIWebSearchRequest({
      query,
      instructions,
      extraContext,
    }),
  );

  return extractOpenAISearchEvidence(query, response);
}
