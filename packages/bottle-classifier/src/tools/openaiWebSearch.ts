import { tool } from "@openai/agents";
import type OpenAI from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseIncludable,
} from "openai/resources/responses/responses";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import { getStableOpenAISettings } from "../openaiModelSettings";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  getDistinctResultDomains,
  getResultDomain,
  isThinBottleSearchEvidence,
  mergeBottleSearchEvidence,
  type BottleWebSearchBudget,
} from "./sharedWebSearch";

const OPENAI_WEB_SEARCH_RESPONSE_INCLUDES: ResponseIncludable[] = [
  "web_search_call.action.sources",
];

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
  onEvidence,
}: {
  client: OpenAI;
  model: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "openai_web_search",
    description:
      "Search live web evidence for decisive bottle or release traits after local search is insufficient. Keep queries narrow and judge results by source content, independence, specificity, and corroboration.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      return await runBottleWebEvidenceSearch({
        client,
        model,
        budget,
        query: args.query,
        onEvidence,
      });
    },
  });
}

export async function runBottleWebEvidenceSearch({
  client,
  model,
  query,
  budget,
  onEvidence,
}: {
  client: OpenAI;
  model: string;
  query: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}): Promise<BottleSearchEvidence | { error: string }> {
  if (!budget.tryConsume()) {
    return budget.getExhaustedError();
  }

  try {
    const primaryEvidence = await runOpenAIWebSearch({
      client,
      model,
      query,
      instructions:
        "Find bottle-specific evidence. Prefer specific, corroborated sources over copied snippets or retailer SEO. Summarize confirmed traits such as producer, bottler, age, ABV, edition, cask, vintage, or release year.",
    });
    const openAIEvidences = [primaryEvidence];

    if (isThinBottleSearchEvidence(primaryEvidence) && budget.tryConsume()) {
      const citedDomains = getDistinctResultDomains(primaryEvidence.results);
      let supplementalEvidence: BottleSearchEvidence | null = null;

      try {
        supplementalEvidence = await runOpenAIWebSearch({
          client,
          model,
          query,
          instructions:
            "Find additional corroborating sources on different domains when possible. Summarize any confirmed proof, ABV, strength, or release traits.",
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
            query,
            evidences: openAIEvidences,
          })
        : primaryEvidence;

    if (openAIEvidence.results.length > 0) {
      onEvidence?.(openAIEvidence);
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
    ...getStableOpenAISettings(model),
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
