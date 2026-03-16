import { tool } from "@openai/agents";
import config from "@peated/server/config";
import { PriceMatchSearchEvidenceSchema } from "@peated/server/schemas";
import type OpenAI from "openai";
import { z } from "zod";

const OpenAIWebSearchArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe(
      "A focused web search query for corroborating bottle evidence. Prefer producer, distillery, bottler, or importer terms over broad whisky keywords, and search for the exact trait that needs validation.",
    ),
});

type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;

function getResultDomain(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

function extractEvidence(query: string, response: any): SearchEvidence {
  const summary = response.output_text?.trim().slice(0, 600) || null;
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
          domain: getResultDomain(annotation.url),
          description: summary,
          extraSnippets: [],
        });
      }
    }
  }

  return PriceMatchSearchEvidenceSchema.parse({
    query,
    summary,
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
      "Search the live web using OpenAI's native web search capability. Use this only after local bottle and entity search are still ambiguous or conflicting. Use it to validate the bottle or release traits that make a match safe. Prefer official producer, distillery, bottler, or importer domains first, then critics or publications, and treat retailer listings as weak corroboration.",
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
          "Search the web for authoritative evidence about a spirits bottle listing. Prefer official producer, distillery, bottler, or importer domains first, then critics or publications. Do not treat the originating retailer as decisive proof. In the cited summary, explicitly mention which bottle or release traits the sources confirm, such as distillery, bottler, cask finish, cask size, cask fill, ABV, age, edition, or release year, and call out any traits the sources do not confirm.",
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
      if (evidence.results.length > 0) {
        onEvidence?.(evidence);
      }
      return evidence;
    },
  });
}
