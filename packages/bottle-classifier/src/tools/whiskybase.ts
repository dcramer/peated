import { tool } from "@openai/agents";
import { z } from "zod";
import type { BottleSearchEvidence } from "../classifierTypes";
import { startToolSpan } from "../observability";
import {
  buildBottleSearchEvidence,
  executeBottleWebSearchInvocation,
  getResultDomain,
  hydrateBottleSearchEvidence,
  type BottleWebSearchBudget,
  type BottleWebSearchExecutor,
  type BottleWebToolResult,
} from "./sharedWebSearch";
import {
  getWhiskybaseUrl,
  lookupWhiskybaseBottle,
  parseWhiskybaseId,
  searchWhiskybase,
  type FirecrawlAccess,
  type WhiskybaseBottle,
  type WhiskybaseDetail,
  type WhiskybaseSearchResult,
} from "./whiskybasePages";

// Not given to the agent yet. The owner approved on-demand moderator lookups
// on 2026-10-22, and the classifier also runs on its own for store listings
// (docs/architecture/bottle-classifier.md, Agent And Tool Boundary).
const WHISKYBASE_SOURCE_NOTE =
  "Whiskybase is a community-entered catalog. Its names use Whiskybase notation, including its own bottler abbreviations, not the producer's printed name. Use it to find and cross-check facts, not as the only evidence for a Bottle: when a decision depends on a Whiskybase fact, look for an independent source, such as a producer, retailer, or auction page, with the remaining search allowance.";
const WHISKYBASE_LOOKUP_TOOL_DESCRIPTION = `Read one Whiskybase entry by Whiskybase ID (WB103088 or 103088) or Whiskybase Bottle URL. Returns its name, Brand, label badges, and listed facts such as bottler, vintage, bottling year, stated age, cask number, strength, and bottle count. Use it when a source names a Whiskybase entry, or on the one search result that agrees with the confirmed Bottle traits. ${WHISKYBASE_SOURCE_NOTE} A "Calculated age" is Whiskybase arithmetic from vintage and bottling year, never a stated age. The lookup already reads the whole entry, so do not read the same Whiskybase page again. Each lookup uses one search allowance.`;
const WHISKYBASE_SEARCH_TOOL_DESCRIPTION = `Search Whiskybase for entries matching one focused Bottle query: the Brand plus reliable identity anchors such as vintage, age, cask number, or series. Returns up to six entries with Whiskybase ID, name, series, and listed facts; the listed Age may be calculated rather than stated. Look up an entry before relying on its facts. ${WHISKYBASE_SOURCE_NOTE} Each search uses one search allowance.`;

// Whiskybase prints this label for its own arithmetic. Peated stores only a
// stated age (docs/operations/catalog-research.md#whiskybase-lookups).
const CALCULATED_AGE_LABEL = "Calculated age";

const WhiskybaseLookupArgsSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1)
    .max(300)
    // The tool returns a readable error for anything else, so the model can
    // correct the reference.
    .describe(
      "Whiskybase ID such as `WB103088` or `103088`, or a Whiskybase Bottle URL.",
    ),
});

const WhiskybaseSearchArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      "One focused Whiskybase search, such as the Brand plus a vintage, age, cask number, or series.",
    ),
});

function formatDetail({ label, value }: WhiskybaseDetail) {
  return label === CALCULATED_AGE_LABEL
    ? `${label} (Whiskybase arithmetic, not a stated age): ${value}`
    : `${label}: ${value}`;
}

export function buildWhiskybaseBottleEvidence(
  bottle: WhiskybaseBottle,
): BottleSearchEvidence {
  const url = getWhiskybaseUrl(bottle.whiskybaseId);
  return buildBottleSearchEvidence({
    provider: "firecrawl",
    query: `WB${bottle.whiskybaseId}`,
    summary: [
      `Whiskybase entry WB${bottle.whiskybaseId} (community-entered).`,
      `Whiskybase name: ${bottle.name}`,
      ...(bottle.brand ? [`Brand: ${bottle.brand}`] : []),
      ...bottle.details.map(formatDetail),
      ...(bottle.badges.length > 0
        ? [`Label badges: ${bottle.badges.join(", ")}`]
        : []),
    ].join("\n"),
    results: [
      {
        title: `${bottle.name} (WB${bottle.whiskybaseId})`,
        url,
        domain: getResultDomain(url),
        description: null,
        extraSnippets: [],
      },
    ],
  });
}

export function buildWhiskybaseSearchEvidence(
  query: string,
  results: WhiskybaseSearchResult[],
): BottleSearchEvidence {
  return buildBottleSearchEvidence({
    provider: "firecrawl",
    query,
    summary:
      results.length > 0
        ? `Whiskybase search results (community-entered). Listed Age may be calculated.`
        : "Whiskybase found no entries.",
    results: results.map((result) => ({
      title: result.series
        ? `${result.name} - ${result.series} (WB${result.whiskybaseId})`
        : `${result.name} (WB${result.whiskybaseId})`,
      url: result.url,
      domain: getResultDomain(result.url),
      description: result.details.map(formatDetail).join("; ") || null,
      extraSnippets: [],
    })),
  });
}

async function runWhiskybaseTool(
  name: string,
  read: () => Promise<BottleSearchEvidence>,
): Promise<BottleSearchEvidence | { error: string }> {
  try {
    return await read();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `${name} failed: ${error.message}`
          : `${name} failed`,
    };
  }
}

export async function runWhiskybaseLookup({
  whiskybaseId,
  ...access
}: FirecrawlAccess & { whiskybaseId: number }) {
  return await runWhiskybaseTool("Whiskybase lookup", async () => {
    const bottle = await lookupWhiskybaseBottle({ ...access, whiskybaseId });
    // A missing entry is a real answer, not a provider failure.
    return bottle
      ? buildWhiskybaseBottleEvidence(bottle)
      : buildBottleSearchEvidence({
          provider: "firecrawl",
          query: `WB${whiskybaseId}`,
          summary: `Whiskybase has no entry WB${whiskybaseId}.`,
          results: [],
        });
  });
}

export async function runWhiskybaseSearch({
  query,
  ...access
}: FirecrawlAccess & { query: string }) {
  return await runWhiskybaseTool("Whiskybase search", async () =>
    buildWhiskybaseSearchEvidence(
      query,
      await searchWhiskybase({ ...access, query }),
    ),
  );
}

async function executeWhiskybaseTool({
  budget,
  executeWebSearch,
  onEvidence,
  toolName,
  args,
  read,
}: {
  budget: BottleWebSearchBudget;
  executeWebSearch?: BottleWebSearchExecutor;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  toolName: "whiskybase_lookup" | "whiskybase_search";
  args: { url: string } | { query: string };
  read: () => Promise<BottleSearchEvidence | { error: string }>;
}): Promise<BottleWebToolResult> {
  let evidenceHydrated = false;
  const hydrateEvidence = (evidence: BottleSearchEvidence) => {
    evidenceHydrated = true;
    onEvidence?.(evidence);
  };
  const result = await executeBottleWebSearchInvocation({
    budget,
    toolName,
    args,
    execute: async () => {
      const evidence = await read();
      if (!("error" in evidence) && evidence.results.length > 0) {
        hydrateEvidence(evidence);
      }
      return evidence;
    },
    executeWebSearch,
  });

  if (executeWebSearch && !evidenceHydrated) {
    hydrateBottleSearchEvidence(result, hydrateEvidence);
  }
  return result;
}

export function createWhiskybaseTools({
  apiKey,
  apiUrl,
  budget,
  onEvidence,
  executeWebSearch,
}: FirecrawlAccess & {
  budget: BottleWebSearchBudget;
  onEvidence?: (evidence: BottleSearchEvidence) => void;
  executeWebSearch?: BottleWebSearchExecutor;
}) {
  return [
    tool({
      name: "whiskybase_lookup",
      description: WHISKYBASE_LOOKUP_TOOL_DESCRIPTION,
      parameters: WhiskybaseLookupArgsSchema,
      execute: async (args) =>
        await startToolSpan({
          name: "whiskybase_lookup",
          description: WHISKYBASE_LOOKUP_TOOL_DESCRIPTION,
          args,
          callback: async () => {
            const whiskybaseId = parseWhiskybaseId(args.reference);
            if (whiskybaseId === null) {
              return {
                error:
                  "Use a Whiskybase ID such as WB103088 or a Whiskybase Bottle URL.",
              };
            }
            return await executeWhiskybaseTool({
              budget,
              executeWebSearch,
              onEvidence,
              toolName: "whiskybase_lookup",
              // Key replays and reviewed evidence on the page that is read.
              args: { url: getWhiskybaseUrl(whiskybaseId) },
              read: () => runWhiskybaseLookup({ apiKey, apiUrl, whiskybaseId }),
            });
          },
        }),
    }),
    tool({
      name: "whiskybase_search",
      description: WHISKYBASE_SEARCH_TOOL_DESCRIPTION,
      parameters: WhiskybaseSearchArgsSchema,
      execute: async (args) =>
        await startToolSpan({
          name: "whiskybase_search",
          description: WHISKYBASE_SEARCH_TOOL_DESCRIPTION,
          args,
          callback: async () =>
            await executeWhiskybaseTool({
              budget,
              executeWebSearch,
              onEvidence,
              toolName: "whiskybase_search",
              args,
              read: () =>
                runWhiskybaseSearch({ apiKey, apiUrl, query: args.query }),
            }),
        }),
    }),
  ];
}
