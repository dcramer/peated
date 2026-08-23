import { tool } from "@openai/agents";
import { z } from "zod";
import {
  BottleSearchEvidenceSchema,
  type BottleSearchEvidence,
} from "../classifierTypes";
import { startToolSpan } from "../observability";
import { canonicalizeWebEvidenceUrl } from "../webEvidenceUrl";
import {
  BottleWebReadPageArgsSchema,
  executeBottleWebSearchInvocation,
  getResultDomain,
  hydrateBottleSearchEvidence,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutor,
} from "./sharedWebSearch";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev";
const FIRECRAWL_READ_TIMEOUT_MS = 30000;
const MAX_PAGE_EVIDENCE_CHARS = 3000;
const FIRECRAWL_READ_PAGE_TOOL_DESCRIPTION =
  "Read exact relevant passages from the Bottle Reference source page or one promising public search result when the available excerpt does not expose the identity-critical fact. The result must agree with every confirmed decisive Bottle trait, or differ only on the uncertain trait being resolved; never use a confirmed conflicting sibling as Suggested Change evidence. One focused page-read allowance is reserved independently from search.";
const FirecrawlPayloadSchema = z.json();
type FirecrawlPayload = z.infer<typeof FirecrawlPayloadSchema>;

const FirecrawlScrapeResponseSchema = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        highlights: z.string().nullable().optional(),
        markdown: z.string().nullable().optional(),
        content: z.string().nullable().optional(),
        metadata: z
          .object({
            title: z.string().nullable().optional(),
            ogTitle: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            ogDescription: z.string().nullable().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export function extractFirecrawlPageEvidence(
  url: string,
  focus: string,
  payload: FirecrawlPayload,
): BottleSearchEvidence {
  const canonicalUrl = canonicalizeWebEvidenceUrl(url);
  const response = FirecrawlScrapeResponseSchema.parse(payload);
  const metadata = response.data.metadata;
  const pageContent =
    response.data.highlights ??
    response.data.markdown ??
    response.data.content ??
    "";
  const excerpt = pageContent.trim().slice(0, MAX_PAGE_EVIDENCE_CHARS);

  return BottleSearchEvidenceSchema.parse({
    provider: "firecrawl",
    query: focus,
    summary: excerpt || null,
    results: [
      {
        title:
          metadata?.title?.trim() || metadata?.ogTitle?.trim() || canonicalUrl,
        url: canonicalUrl,
        domain: getResultDomain(canonicalUrl),
        description:
          metadata?.description?.trim() ||
          metadata?.ogDescription?.trim() ||
          null,
        extraSnippets: [],
      },
    ],
  });
}

export function createFirecrawlReadPageTool({
  apiKey,
  apiUrl = FIRECRAWL_API_URL,
  budget,
  onEvidence,
  executeWebSearch,
}: {
  apiKey: string;
  apiUrl?: string;
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  executeWebSearch?: BottleWebSearchExecutor;
}) {
  return tool({
    name: "firecrawl_read_page",
    description: FIRECRAWL_READ_PAGE_TOOL_DESCRIPTION,
    parameters: BottleWebReadPageArgsSchema,
    execute: async (args) => {
      return await startToolSpan({
        name: "firecrawl_read_page",
        description: FIRECRAWL_READ_PAGE_TOOL_DESCRIPTION,
        args,
        callback: async () => {
          let evidenceHydrated = false;
          const hydrateEvidence = (evidence: BottleSearchEvidence) => {
            evidenceHydrated = true;
            onEvidence?.(evidence);
          };
          const execute = async () => {
            const evidence = await runFirecrawlReadPage({
              apiKey,
              apiUrl,
              url: args.url,
              focus: args.focus,
            });
            if (!("error" in evidence)) {
              hydrateEvidence(evidence);
            }
            return evidence;
          };
          const result = await executeBottleWebSearchInvocation({
            budget,
            toolName: "firecrawl_read_page",
            args,
            execute,
            executeWebSearch,
          });

          if (executeWebSearch && !evidenceHydrated) {
            hydrateBottleSearchEvidence(result, hydrateEvidence);
          }

          return result;
        },
      });
    },
  });
}

export async function runFirecrawlReadPage({
  apiKey,
  apiUrl = FIRECRAWL_API_URL,
  url,
  focus,
}: {
  apiKey: string;
  apiUrl?: string;
  url: string;
  focus: string;
}): Promise<BottleSearchEvidence | { error: string }> {
  try {
    const response = await fetch(new URL("/v2/scrape", apiUrl), {
      method: "POST",
      signal: AbortSignal.timeout(FIRECRAWL_READ_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [{ type: "highlights", query: focus }],
        onlyMainContent: true,
        proxy: "basic",
      }),
    });

    if (!response.ok) {
      return {
        error: `Firecrawl page read failed (${response.status})`,
      };
    }

    return extractFirecrawlPageEvidence(
      url,
      focus,
      FirecrawlPayloadSchema.parse(await response.json()),
    );
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Firecrawl page read failed: ${error.message}`
          : "Firecrawl page read failed",
    };
  }
}
