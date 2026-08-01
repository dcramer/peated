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
import { startToolSpan } from "../observability";
import { getStableOpenAISettings } from "../openaiModelSettings";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  executeBottleWebSearchInvocation,
  getDistinctResultDomains,
  getResultDomain,
  hydrateBottleSearchEvidence,
  isThinBottleSearchEvidence,
  mergeBottleSearchEvidence,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";

const OPENAI_WEB_SEARCH_RESPONSE_INCLUDES: ResponseIncludable[] = [
  "web_search_call.action.sources",
];
const OPENAI_WEB_SEARCH_TOOL_DESCRIPTION =
  "Search live web evidence for decisive bottle or release traits after local search is insufficient. Keep queries narrow and judge results by source content, independence, specificity, and corroboration.";
const MARKDOWN_HTTP_LINK_PATTERN =
  /(?<!!)\[([^\]\r\n]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : null;
}

function getArrayProperty(
  record: UnknownRecord | null,
  key: string,
): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function getRecordProperty(
  record: UnknownRecord | null,
  key: string,
): UnknownRecord | null {
  return asRecord(record?.[key]);
}

function getStringProperty(
  record: UnknownRecord | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function extractMarkdownHttpLinks(text: string) {
  return Array.from(text.matchAll(MARKDOWN_HTTP_LINK_PATTERN), (match) => ({
    title: match[1]?.trim() || null,
    url: match[2] ?? null,
  }));
}

export function extractOpenAISearchEvidence(
  query: string,
  response: unknown,
): BottleSearchEvidence {
  const responseRecord = asRecord(response);
  const outputItems = getArrayProperty(responseRecord, "output");
  const messageTexts = outputItems.flatMap((outputItem) => {
    const item = asRecord(outputItem);
    if (getStringProperty(item, "type") !== "message") {
      return [];
    }

    return getArrayProperty(item, "content").flatMap((contentItem) => {
      const content = asRecord(contentItem);
      if (getStringProperty(content, "type") !== "output_text") {
        return [];
      }

      const text = getStringProperty(content, "text")?.trim();
      return text ? [text] : [];
    });
  });
  const outputText = getStringProperty(responseRecord, "output_text")?.trim();
  const responseTexts = [outputText, ...messageTexts].filter(
    (text): text is string => Boolean(text),
  );
  const summary =
    outputText?.slice(0, 600) ||
    messageTexts.join(" ").trim().slice(0, 600) ||
    null;
  const resultsByUrl = new Map<
    string,
    BottleSearchEvidence["results"][number]
  >();
  const citedResultUrls = new Set<string>();

  const mergeResult = ({
    cited = false,
    title,
    url,
  }: {
    cited?: boolean;
    title?: string | null;
    url: string | null | undefined;
  }) => {
    if (!url) {
      return;
    }

    if (cited) {
      citedResultUrls.add(url);
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

  for (const outputItem of outputItems) {
    const item = asRecord(outputItem);
    const itemType = getStringProperty(item, "type");
    if (itemType === "message") {
      for (const contentItem of getArrayProperty(item, "content")) {
        const content = asRecord(contentItem);
        if (getStringProperty(content, "type") !== "output_text") {
          continue;
        }

        for (const annotationItem of getArrayProperty(content, "annotations")) {
          const annotation = asRecord(annotationItem);
          if (getStringProperty(annotation, "type") !== "url_citation") {
            continue;
          }

          mergeResult({
            cited: true,
            title: getStringProperty(annotation, "title"),
            url: getStringProperty(annotation, "url"),
          });
        }
      }
      continue;
    }

    if (itemType !== "web_search_call") {
      continue;
    }

    const action = getRecordProperty(item, "action");
    const actionType = getStringProperty(action, "type");
    if (actionType === "search") {
      for (const sourceItem of getArrayProperty(action, "sources")) {
        const source = asRecord(sourceItem);
        if (getStringProperty(source, "type") !== "url") {
          continue;
        }

        mergeResult({
          url: getStringProperty(source, "url"),
        });
      }
      continue;
    }

    if (actionType === "open_page" || actionType === "find_in_page") {
      mergeResult({
        url: getStringProperty(action, "url"),
      });
    }
  }

  // The Vercel AI Gateway can preserve citations only as Markdown links in
  // response text, so recover those links before the summary is truncated.
  for (const text of responseTexts) {
    for (const link of extractMarkdownHttpLinks(text)) {
      mergeResult({ ...link, cited: true });
    }
  }

  const results = Array.from(resultsByUrl.values());
  return buildBottleSearchEvidence({
    provider: "openai",
    query,
    summary,
    results: [
      ...results.filter((result) => citedResultUrls.has(result.url)),
      ...results.filter((result) => !citedResultUrls.has(result.url)),
    ],
  });
}

export function createOpenAIWebSearchTool({
  client,
  model,
  budget,
  onEvidence,
  executeWebSearch,
}: {
  client: OpenAI;
  model: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  executeWebSearch?: BottleWebSearchExecutor;
}) {
  return tool({
    name: "openai_web_search",
    description: OPENAI_WEB_SEARCH_TOOL_DESCRIPTION,
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "openai_web_search",
        description: OPENAI_WEB_SEARCH_TOOL_DESCRIPTION,
        args,
        callback: async () =>
          await runBottleWebEvidenceSearch({
            client,
            model,
            budget,
            query: args.query,
            onEvidence,
            executeWebSearch,
          }),
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
  executeWebSearch,
}: {
  client: OpenAI;
  model: string;
  query: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  executeWebSearch?: BottleWebSearchExecutor;
}): Promise<BottleSearchEvidence | { error: string }> {
  let evidenceHydrated = false;
  const hydrateEvidence = (evidence: BottleSearchEvidence) => {
    evidenceHydrated = true;
    onEvidence?.(evidence);
  };
  const result = await executeBottleWebSearchInvocation({
    budget,
    toolName: "openai_web_search",
    args: { query },
    execute: async () =>
      await runBottleWebEvidenceSearchAfterBudget({
        client,
        model,
        query,
        budget,
        onEvidence: hydrateEvidence,
      }),
    executeWebSearch,
  });

  if (executeWebSearch && !evidenceHydrated) {
    hydrateBottleSearchEvidence(result, hydrateEvidence);
  }

  return result;
}

async function runBottleWebEvidenceSearchAfterBudget({
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
