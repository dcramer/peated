import { tool } from "@openai/agents";
import type OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { z } from "zod";
import {
  EntityClassificationSearchEvidenceSchema,
  type EntityClassificationSearchEvidence,
} from "../classifierTypes";
import { getDeterministicOpenAISettings } from "../openaiModelSettings";

const WebSearchArgsSchema = z
  .object({
    query: z.string().trim().min(1),
  })
  .strict();

function getResultDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildOpenAIWebSearchRequest({
  model,
  query,
}: {
  model: string;
  query: string;
}): ResponseCreateParamsNonStreaming {
  return {
    model,
    instructions:
      "Search the web for authoritative information about a whisky brand, distillery, or bottler entity. Prefer official producer or distillery websites first, then trusted publications. Focus on producer naming, official branding, website identity, location, and whether the row appears to be a valid brand versus a generic category term. Cite 2 to 4 URLs when possible.",
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: query }],
      },
    ],
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"],
    ...getDeterministicOpenAISettings(model),
  };
}

function extractSearchEvidence(
  query: string,
  response: any,
): EntityClassificationSearchEvidence {
  const outputItems: any[] = Array.isArray(response?.output)
    ? response.output
    : [];
  const resultsByUrl = new Map<
    string,
    EntityClassificationSearchEvidence["results"][number]
  >();

  const summary =
    typeof response?.output_text === "string" && response.output_text.trim()
      ? response.output_text.trim().slice(0, 700)
      : null;

  const mergeResult = ({
    title,
    url,
  }: {
    title?: null | string;
    url?: null | string;
  }) => {
    if (!url) {
      return;
    }

    const existing = resultsByUrl.get(url);
    if (existing) {
      return;
    }

    resultsByUrl.set(url, {
      title: title?.trim() || url,
      url,
      domain: getResultDomain(url),
      description: summary,
    });
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

    for (const source of Array.isArray(item.action?.sources)
      ? item.action.sources
      : []) {
      if (source?.type !== "url") {
        continue;
      }

      mergeResult({
        url: source.url,
      });
    }
  }

  return EntityClassificationSearchEvidenceSchema.parse({
    provider: "openai",
    query,
    summary,
    results: Array.from(resultsByUrl.values()),
  });
}

export function createOpenAIWebSearchTool({
  client,
  maxSearchQueries,
  model,
  onEvidence,
}: {
  client: OpenAI;
  maxSearchQueries: number;
  model: string;
  onEvidence?: (evidence: EntityClassificationSearchEvidence) => void;
}) {
  let remainingQueries = maxSearchQueries;

  return tool({
    name: "openai_web_search",
    description:
      "Search the live web for official producer naming, website, location, and branding evidence. Prefer official sources and use this only when local entity evidence is still ambiguous.",
    parameters: WebSearchArgsSchema,
    execute: async (args) => {
      if (remainingQueries <= 0) {
        return {
          error: "Web search budget exhausted.",
        };
      }

      remainingQueries -= 1;
      const parsedArgs = WebSearchArgsSchema.parse(args);

      try {
        const response = await client.responses.create(
          buildOpenAIWebSearchRequest({
            model,
            query: parsedArgs.query,
          }),
        );
        const evidence = extractSearchEvidence(parsedArgs.query, response);
        onEvidence?.(evidence);
        return evidence;
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
