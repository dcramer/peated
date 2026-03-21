import { tool } from "@openai/agents";
import config from "@peated/server/config";
import type OpenAI from "openai";
import type { BottleSearchEvidence } from "../schemas";
import {
  BottleWebSearchArgsSchema,
  buildBottleSearchEvidence,
  getResultDomain,
  type BottleWebSearchBudget,
} from "./sharedWebSearch";

export function extractOpenAISearchEvidence(
  query: string,
  response: any,
): BottleSearchEvidence {
  const summary = response.output_text?.trim().slice(0, 600) || null;
  const seen = new Set<string>();
  const results: BottleSearchEvidence["results"] = [];

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

  return buildBottleSearchEvidence({
    provider: "openai",
    query,
    summary,
    results,
  });
}

export function createOpenAIWebSearchTool({
  client,
  budget,
  onEvidence,
}: {
  client: OpenAI;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
}) {
  return tool({
    name: "openai_web_search",
    description:
      "Search the live web using OpenAI's native web search capability. This is the default web search tool when local bottle and entity search are still ambiguous or conflicting. Use it to validate the bottle or release traits that make a match safe, especially when the source text may have omitted a canonical trait that could bridge a generic reference to a more specific local candidate. Prefer official producer, distillery, bottler, or importer domains first, then critics or publications, and treat retailer pages as weak corroboration.",
    parameters: BottleWebSearchArgsSchema,
    execute: async (args) => {
      if (!budget.tryConsume()) {
        return budget.getExhaustedError();
      }

      try {
        const response = await client.responses.create({
          model: config.OPENAI_MODEL,
          instructions:
            "Search the web for authoritative evidence about a spirits bottle reference. Prefer official producer, distillery, bottler, or importer domains first, then critics or publications. Do not treat the originating retailer or source page as decisive proof. In the cited summary, explicitly mention which bottle or release traits the sources confirm, such as distillery, bottler, cask finish, cask size, cask fill, ABV, age, edition, or release year, and call out any traits the sources do not confirm. When the goal is to determine whether a generic source title still points at a more specific canonical bottle, explicitly say whether the sources confirm the omitted trait that would bridge that gap, such as barrel proof or a numbered edition.",
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

        const evidence = extractOpenAISearchEvidence(args.query, response);
        if (evidence.results.length > 0) {
          onEvidence?.(evidence);
        }
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
