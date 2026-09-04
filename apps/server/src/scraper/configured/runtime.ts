import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSiteScrapeTargets,
  externalSites,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
} from "@peated/server/db/schema";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ScraperHttpStatusError } from "../http";
import { externalReviewSink } from "../sinks/externalReviews";
import { createStorePriceSink } from "../sinks/storePrices";
import type {
  ScrapeTargetDefinition,
  ScraperAdapter,
  ScraperObservation,
  ScraperRegistry,
  ScraperSink,
  ScraperSourceDefinition,
} from "../types";
import { findLikelyDetailPages, findLikelyListPages } from "./discovery";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import {
  ScrapeSourcePreviewPageSchema,
  type ScrapeIssue,
  type ScrapeSourcePreviewPage,
} from "./preview";
import {
  SCRAPE_SOURCE_MAX_LIST_PAGES,
  parseScrapeRules,
  type ScrapeRules,
} from "./rules";
import { recordScrapeSourcePreview } from "./service";
import {
  MAX_SUGGESTION_DETAIL_PAGES,
  suggestionRequestLimit,
} from "./setupAgent";
import { suggestScrapeSourceRevision } from "./suggestion";
import { loadScrapeSourceTarget } from "./target";

class ScrapeSourceParseError extends Error {
  override name = "ScrapeSourceParseError";

  constructor(readonly issues: ScrapeIssue[]) {
    super("The page did not match the saved parsing rules.");
  }
}

/** Runs use their saved source even while the old scraper code is deployed. */
function registryForSource(
  baseRegistry: ScraperRegistry,
  source: ScraperSourceDefinition,
  target: ScrapeTargetDefinition,
): ScraperRegistry {
  const sources = new Map(baseRegistry.sources);
  for (const [key, registered] of sources) {
    if (registered.externalSiteKey === source.externalSiteKey) {
      sources.delete(key);
    }
  }
  if (sources.has(source.key)) {
    throw new Error(
      "This scrape source key is already used by another source.",
    );
  }
  sources.set(source.key, source);
  const targets = new Map(baseRegistry.targets);
  targets.set(target.key, target);
  return { sources, targets };
}

function createPreviewPage(
  observation: ScraperObservation<unknown>,
  kind: "review" | "price",
  url: string,
): ScrapeSourcePreviewPage {
  if (kind === "review") {
    const value = ExternalReviewArticleIngestionSchema.parse(observation.value);
    return {
      kind,
      url,
      title: value.article.title,
      publishedAt: value.article.publishedAt?.toISOString() ?? null,
      reviews: value.article.externalReviews.map((review) => ({
        name: review.name,
        reviewerName: review.reviewerName ?? null,
        nativeScore: review.nativeScore ?? null,
      })),
    };
  }
  return {
    kind,
    url,
    products: z
      .array(StorePriceInputSchema)
      .parse(observation.value)
      .map((product) => ({
        externalProductId: product.externalProductId ?? null,
        name: product.name,
        price: product.price,
        currency: product.currency,
        volume: product.volume,
        url: product.url,
        imageUrl: product.imageUrl ?? null,
        barcode: product.barcode ?? null,
      })),
  };
}

type RecordScrapeSourcePreview = (input: {
  status: "passed" | "failed";
  result: {
    issues: ScrapeIssue[];
    pages: ScrapeSourcePreviewPage[];
  };
}) => Promise<void>;

const ConfiguredScrapeCursorSchema = z
  .object({
    listUrls: z.array(z.url()).max(SCRAPE_SOURCE_MAX_LIST_PAGES),
    detailUrls: z.array(z.url()).max(99),
    nextListUrl: z.url().nullable(),
    detailIndex: z.number().int().min(0).max(99),
    previewPages: z.array(ScrapeSourcePreviewPageSchema).max(99),
  })
  .strict();

type ConfiguredScrapeCursor = z.infer<typeof ConfiguredScrapeCursorSchema>;

function createScrapeSourceAdapter(
  input: {
    targetKey: string;
    listUrl: string;
    rules: ScrapeRules;
  } & (
    | { purpose: "collect" }
    | { purpose: "preview"; recordPreview: RecordScrapeSourcePreview }
  ),
): ScraperAdapter<ConfiguredScrapeCursor, unknown> {
  return async ({ cursor, session }) => {
    let state: ConfiguredScrapeCursor = cursor ?? {
      listUrls: [],
      detailUrls: [],
      nextListUrl: new URL(input.listUrl).toString(),
      detailIndex: 0,
      previewPages: [],
    };
    try {
      const listUrls = new Set(state.listUrls);
      const detailUrls = new Set(state.detailUrls);
      while (
        state.nextListUrl &&
        listUrls.size < SCRAPE_SOURCE_MAX_LIST_PAGES &&
        detailUrls.size < input.rules.list.maxItems
      ) {
        if (listUrls.has(state.nextListUrl)) {
          throw new ScrapeSourceParseError([
            {
              field: "list.nextPage",
              message: "Pagination returned a page that was already read.",
            },
          ]);
        }
        listUrls.add(state.nextListUrl);
        const listResponse = await session.request({
          target: input.targetKey,
          url: new URL(state.nextListUrl),
        });
        const listResult = parseScrapeList(
          input.rules,
          listResponse.body,
          listResponse.url,
        );
        if (listResult.issues.length > 0) {
          throw new ScrapeSourceParseError(listResult.issues);
        }
        for (const link of listResult.links) {
          detailUrls.add(link);
          if (detailUrls.size >= input.rules.list.maxItems) break;
        }
        state = {
          ...state,
          listUrls: [...listUrls],
          detailUrls: [...detailUrls],
          nextListUrl: listResult.nextPageUrl,
        };
        await session.checkpoint(state);
      }

      while (state.detailIndex < state.detailUrls.length) {
        const link = state.detailUrls[state.detailIndex];
        if (!link) throw new Error("Configured scraper detail URL is missing.");
        const response = await session.request({
          target: input.targetKey,
          url: new URL(link),
        });
        const parsed = parseScrapeDetail(
          input.rules,
          response.body,
          response.url,
        );
        if (parsed.issues.length > 0 || !parsed.value) {
          throw new ScrapeSourceParseError(parsed.issues);
        }
        const observation = {
          sourceKey: response.url.toString(),
          value: parsed.value,
          itemCount:
            parsed.kind === "review"
              ? parsed.value.article.externalReviews.length
              : parsed.value.length,
        };
        if (input.purpose === "preview") {
          state.previewPages.push(
            createPreviewPage(
              observation,
              parsed.kind,
              response.url.toString(),
            ),
          );
        } else {
          await session.emit(observation);
        }
        state = { ...state, detailIndex: state.detailIndex + 1 };
        await session.checkpoint(state);
      }

      if (input.purpose === "preview") {
        await input.recordPreview({
          status: state.previewPages.length > 0 ? "passed" : "failed",
          result: {
            issues:
              state.previewPages.length > 0
                ? []
                : [
                    {
                      field: "list.detailLink",
                      message: "No pages produced valid output.",
                    },
                  ],
            pages: state.previewPages,
          },
        });
      }
    } catch (error) {
      if (
        input.purpose === "preview" &&
        error instanceof ScrapeSourceParseError
      ) {
        await input.recordPreview({
          status: "failed",
          result: { issues: error.issues, pages: state.previewPages },
        });
      }
      throw error;
    }
  };
}

/** Builds the no-write source used by local acceptance previews. */
export function createLocalScrapeSourcePreview(input: {
  siteKey: string;
  targetKey: string;
  listUrl: string;
  rules: ScrapeRules;
  recordPreview: RecordScrapeSourcePreview;
}): ScraperSourceDefinition<ConfiguredScrapeCursor, unknown> {
  return {
    key: `local-preview-${input.siteKey}`,
    externalSiteKey: input.siteKey,
    targetKeys: [input.targetKey],
    requestLimit: input.rules.list.maxItems + SCRAPE_SOURCE_MAX_LIST_PAGES,
    resumeFromLastRun: false,
    cursorSchema: ConfiguredScrapeCursorSchema,
    observationSchema:
      input.rules.kind === "review"
        ? ExternalReviewArticleIngestionSchema
        : z.array(StorePriceInputSchema),
    adapter: createScrapeSourceAdapter({
      targetKey: input.targetKey,
      listUrl: input.listUrl,
      rules: input.rules,
      purpose: "preview",
      recordPreview: input.recordPreview,
    }),
    sink: async () => {},
  };
}

function createScrapeSourceDefinition(input: {
  siteKey: string;
  scrapeSourceId: number;
  revisionId: number;
  targetKey: string;
  listUrl: string;
  purpose: "collect" | "preview";
  rules: ScrapeRules;
}): ScraperSourceDefinition<ConfiguredScrapeCursor, unknown> {
  const observationSchema =
    input.rules.kind === "review"
      ? ExternalReviewArticleIngestionSchema
      : z.array(StorePriceInputSchema);
  const sink: ScraperSink<unknown> =
    input.purpose === "preview"
      ? async () => {}
      : input.rules.kind === "review"
        ? async ({ externalSiteId, observation }) => {
            await externalReviewSink({
              externalSiteId,
              observation: {
                ...observation,
                value: ExternalReviewArticleIngestionSchema.parse(
                  observation.value,
                ),
              },
            });
          }
        : async ({ externalSiteId, observation }) => {
            await createStorePriceSink(input.siteKey)({
              externalSiteId,
              observation: {
                ...observation,
                value: z.array(StorePriceInputSchema).parse(observation.value),
              },
            });
          };

  const adapter =
    input.purpose === "preview"
      ? createScrapeSourceAdapter({
          targetKey: input.targetKey,
          listUrl: input.listUrl,
          rules: input.rules,
          purpose: "preview",
          recordPreview: async ({ status, result }) => {
            await recordScrapeSourcePreview({
              revisionId: input.revisionId,
              status,
              result,
            });
          },
        })
      : createScrapeSourceAdapter({
          targetKey: input.targetKey,
          listUrl: input.listUrl,
          rules: input.rules,
          purpose: "collect",
        });

  return {
    key: `source-${input.scrapeSourceId}`,
    externalSiteKey: input.siteKey,
    targetKeys: [input.targetKey],
    requestLimit: input.rules.list.maxItems + SCRAPE_SOURCE_MAX_LIST_PAGES,
    resumeFromLastRun: false,
    cursorSchema: ConfiguredScrapeCursorSchema,
    observationSchema,
    adapter,
    sink,
  };
}

/** Adds the saved source for this run to the scraper registry. */
export async function resolveScrapeSourceRunRegistry(
  runId: number,
  baseRegistry: ScraperRegistry,
): Promise<ScraperRegistry> {
  const [suggestion] = await db
    .select({
      run: scrapeSourceRuns,
      requestedById: externalSiteRuns.requestedById,
      source: scrapeSources,
      siteKey: externalSites.type,
      target: scrapeTargets,
    })
    .from(scrapeSourceRuns)
    .innerJoin(
      externalSiteRuns,
      eq(externalSiteRuns.id, scrapeSourceRuns.externalSiteRunId),
    )
    .innerJoin(
      scrapeSources,
      eq(scrapeSources.id, scrapeSourceRuns.scrapeSourceId),
    )
    .innerJoin(
      externalSites,
      eq(externalSites.id, scrapeSources.externalSiteId),
    )
    .innerJoin(
      externalSiteScrapeTargets,
      and(
        eq(
          externalSiteScrapeTargets.externalSiteId,
          scrapeSources.externalSiteId,
        ),
        eq(externalSiteScrapeTargets.active, true),
      ),
    )
    .innerJoin(
      scrapeTargets,
      eq(scrapeTargets.key, externalSiteScrapeTargets.targetKey),
    )
    .where(
      and(
        eq(scrapeSourceRuns.externalSiteRunId, runId),
        eq(scrapeSourceRuns.purpose, "suggest"),
      ),
    );
  if (suggestion) {
    const requestedById = suggestion.requestedById;
    if (suggestion.run.revisionId === null && !requestedById) {
      throw new Error("AI suggestion run has no requesting admin.");
    }
    const target = await loadScrapeSourceTarget(suggestion.target);
    const adapter: ScraperAdapter<null, unknown> =
      suggestion.run.revisionId !== null
        ? // A linked revision means the suggestion finished before the run was retried.
          async () => {}
        : async ({ session }) => {
            if (!requestedById) {
              throw new Error("AI suggestion run has no requesting admin.");
            }
            const entryResponse = await session.request({
              target: target.key,
              url: new URL(suggestion.source.listUrl),
            });
            const sampleUrls = new Set(
              suggestion.source.sampleUrls.map((value) =>
                new URL(value).toString(),
              ),
            );
            const listPages = [
              {
                url: entryResponse.url.toString(),
                html: entryResponse.body,
              },
            ];
            const likelyListPages = findLikelyListPages({
              kind: suggestion.source.kind,
              pageUrl: entryResponse.url,
              html: entryResponse.body,
            }).filter((value) => !sampleUrls.has(value));
            for (const value of likelyListPages) {
              try {
                const response = await session.request({
                  target: target.key,
                  url: new URL(value),
                });
                listPages.push({
                  url: response.url.toString(),
                  html: response.body,
                });
              } catch (error) {
                if (
                  error instanceof ScraperHttpStatusError &&
                  [404, 410].includes(error.status)
                ) {
                  continue;
                }
                throw error;
              }
            }
            const detailPages = [];
            for (const value of sampleUrls) {
              if (value === entryResponse.url.toString()) continue;
              const response = await session.request({
                target: target.key,
                url: new URL(value),
              });
              detailPages.push({
                url: response.url.toString(),
                html: response.body,
              });
            }
            const suppliedDetailUrls = new Set(
              detailPages.map((page) => new URL(page.url).toString()),
            );
            const likelyDetailPages = findLikelyDetailPages({
              kind: suggestion.source.kind,
              limit: MAX_SUGGESTION_DETAIL_PAGES,
              pages: listPages,
            }).filter((value) => !suppliedDetailUrls.has(value));
            for (const value of likelyDetailPages) {
              try {
                const response = await session.request({
                  target: target.key,
                  url: new URL(value),
                });
                detailPages.push({
                  url: response.url.toString(),
                  html: response.body,
                });
              } catch (error) {
                if (
                  error instanceof ScraperHttpStatusError &&
                  [404, 410].includes(error.status)
                ) {
                  continue;
                }
                throw error;
              }
            }
            const revision = await suggestScrapeSourceRevision({
              scrapeSourceId: suggestion.source.id,
              externalSiteRunId: runId,
              createdById: requestedById,
              listPages,
              detailPages,
              loadPage: async (url) => {
                const response = await session.request({
                  target: target.key,
                  url,
                });
                return {
                  url: response.url.toString(),
                  html: response.body,
                };
              },
            });
            await db
              .update(scrapeSourceRuns)
              .set({ revisionId: revision.id })
              .where(eq(scrapeSourceRuns.externalSiteRunId, runId));
          };
    const source: ScraperSourceDefinition<null, unknown> = {
      key: `source-${suggestion.source.id}`,
      externalSiteKey: suggestion.siteKey,
      targetKeys: [target.key],
      requestLimit: suggestionRequestLimit(suggestion.source.sampleUrls.length),
      resumeFromLastRun: false,
      cursorSchema: z.null(),
      observationSchema: z.unknown(),
      sink: async () => {},
      adapter,
    };
    return registryForSource(baseRegistry, source, target);
  }

  const [row] = await db
    .select({
      run: scrapeSourceRuns,
      source: scrapeSources,
      revision: scrapeSourceRevisions,
      siteKey: externalSites.type,
      target: scrapeTargets,
    })
    .from(scrapeSourceRuns)
    .innerJoin(
      scrapeSources,
      eq(scrapeSources.id, scrapeSourceRuns.scrapeSourceId),
    )
    .innerJoin(
      scrapeSourceRevisions,
      eq(scrapeSourceRevisions.id, scrapeSourceRuns.revisionId),
    )
    .innerJoin(
      externalSites,
      eq(externalSites.id, scrapeSources.externalSiteId),
    )
    .innerJoin(
      externalSiteScrapeTargets,
      and(
        eq(
          externalSiteScrapeTargets.externalSiteId,
          scrapeSources.externalSiteId,
        ),
        eq(externalSiteScrapeTargets.active, true),
      ),
    )
    .innerJoin(
      scrapeTargets,
      eq(scrapeTargets.key, externalSiteScrapeTargets.targetKey),
    )
    .where(eq(scrapeSourceRuns.externalSiteRunId, runId));
  if (!row) return baseRegistry;

  const rules = parseScrapeRules(row.revision.rulesVersion, row.revision.rules);
  if (row.run.purpose === "suggest") {
    throw new Error("An AI run cannot use saved parsing rules.");
  }
  if (rules.kind !== row.source.kind) {
    throw new Error("The parsing rules collect the wrong content.");
  }
  const target = await loadScrapeSourceTarget(row.target);
  const source = createScrapeSourceDefinition({
    siteKey: row.siteKey,
    scrapeSourceId: row.source.id,
    revisionId: row.revision.id,
    targetKey: target.key,
    listUrl: row.revision.listUrl,
    purpose: row.run.purpose,
    rules,
  });
  return registryForSource(baseRegistry, source, target);
}
