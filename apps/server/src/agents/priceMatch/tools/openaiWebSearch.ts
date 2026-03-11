import { tool } from "@openai/agents";
import config from "@peated/server/config";
import { PriceMatchSearchEvidenceSchema } from "@peated/server/schemas";
import type OpenAI from "openai";
import { z } from "zod";

const OpenAIWebSearchArgsSchema = z.object({
  query: z.string().trim().min(1),
});

type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;

function extractEvidence(query: string, response: any): SearchEvidence {
  const summary = response.output_text?.trim().slice(0, 240) || null;
  const seen = new Set<string>();
  const results: SearchEvidence["results"] = [];

  for (const item of response.output) {
    if (item.type !== "message") continue;

    for (const content of item.content) {
      if (content.type !== "output_text") continue;

      for (const annotation of content.annotations || []) {
        if (annotation.type !== "url_citation") continue;
        if (seen.has(annotation.url)) continue;
        seen.add(annotation.url);

        results.push({
          title: annotation.title || annotation.url,
          url: annotation.url,
          description: summary,
          extraSnippets: [],
        });
      }
    }
  }

  return PriceMatchSearchEvidenceSchema.parse({
    query,
    results,
  });
}

export function createOpenAIWebSearchTool({
  client,
  maxQueries,
  onEvidence,
}: {
  client: OpenAI;
  maxQueries: number;
  onEvidence?: (evidence: SearchEvidence) => void;
}) {
  let searchCalls = 0;

  return tool({
    name: "openai_web_search",
    description:
      "Search the live web using OpenAI's native web search capability. Use this only after local bottle and entity search is still ambiguous.",
    parameters: OpenAIWebSearchArgsSchema,
    execute: async (args) => {
      if (searchCalls >= maxQueries) {
        return {
          error: `Search budget exhausted after ${maxQueries} queries`,
        };
      }

      searchCalls += 1;

      const response = await client.responses.create({
        model: config.OPENAI_MODEL,
        instructions:
          "Search the web for corroborating evidence about a spirits bottle listing and answer with a short cited summary.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: args.query,
              },
            ],
          },
        ],
        tools: [{ type: "web_search_preview" }],
        temperature: 0,
      });

      const evidence = extractEvidence(args.query, response);
      onEvidence?.(evidence);
      return evidence;
    },
  });
}
