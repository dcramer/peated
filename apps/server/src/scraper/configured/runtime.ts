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
import {
  CatalogListingInputSchema,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ScraperCoordinationError } from "../coordinator";
import { ScraperHttpStatusError, ScraperRequestWaitError } from "../http";
import { ScraperRunTakenOverError } from "../session";
import { catalogListingSink } from "../sinks/catalogListings";
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
import {
  loadExecutableScrapeRules,
  type ExecutableScrapeRules,
} from "./compatibility";
import {
  MAX_LIKELY_LIST_PAGES,
  findAdvertisedSyndicationPages,
  findLikelyDetailPages,
  findLikelyListPages,
  inspectSyndicationFeed,
} from "./discovery";
import {
  ScrapeSourcePreviewPageSchema,
  type ScrapeIssue,
  type ScrapeSourcePreviewPage,
} from "./preview";
import { SCRAPE_SOURCE_MAX_LIST_PAGES } from "./rules";
import {
  ScrapeSourceSuggestionCursorSchema,
  type ScrapeSourceSuggestionCursor,
} from "./runs";
import { recordScrapeSourcePreview } from "./service";
import { MAX_EXAMPLE_PAGES } from "./setupAgent";
import {
  suggestScrapeSourceRevision,
  type RequestScrapeSourceModel,
} from "./suggestion";
import { loadScrapeSourceTarget } from "./target";

export class ScrapeSourceParseError extends Error {
  override name = "ScrapeSourceParseError";

  constructor(
    readonly pageUrl: string,
    readonly issues: ScrapeIssue[],
  ) {
    super("The page did not match the saved rules.");
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
  kind: "review" | "price" | "catalog",
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
  if (kind === "catalog") {
    return {
      kind,
      url,
      products: z
        .array(CatalogListingInputSchema)
        .parse(observation.value)
        .map((product) => ({
          externalProductId: product.externalProductId ?? null,
          name: product.name,
          url: product.url,
          imageUrl: product.imageUrl ?? null,
          volume: product.volume ?? null,
          sourceBottleIdentity: product.sourceBottleIdentity ?? null,
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

function observationSchemaForRules(rules: ExecutableScrapeRules) {
  if (rules.kind === "review") return ExternalReviewArticleIngestionSchema;
  if (rules.kind === "catalog") return z.array(CatalogListingInputSchema);
  return z.array(StorePriceInputSchema);
}

function createScrapeSourceAdapter(
  input: {
    targetKey: string;
    listUrl: string;
    rules: ExecutableScrapeRules;
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
        detailUrls.size < input.rules.limit
      ) {
        if (listUrls.has(state.nextListUrl)) {
          throw new ScrapeSourceParseError(state.nextListUrl, [
            {
              field: input.rules.nextPageField,
              message: "Pagination returned a page that was already read.",
            },
          ]);
        }
        listUrls.add(state.nextListUrl);
        let listResponse;
        try {
          listResponse = await session.request({
            target: input.targetKey,
            url: new URL(state.nextListUrl),
            canResumeLater: true,
          });
        } catch (error) {
          if (error instanceof ScraperRequestWaitError && error.resumeUrl) {
            state = { ...state, nextListUrl: error.resumeUrl.toString() };
            await session.checkpoint(state);
          }
          throw error;
        }
        const listResult = input.rules.parseList(
          listResponse.body,
          listResponse.url,
        );
        if (listResult.issues.length > 0) {
          throw new ScrapeSourceParseError(
            listResponse.url.toString(),
            listResult.issues,
          );
        }
        for (const link of listResult.links) {
          detailUrls.add(link);
          if (detailUrls.size >= input.rules.limit) break;
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
        let response;
        try {
          response = await session.request({
            target: input.targetKey,
            url: new URL(link),
            canResumeLater: true,
          });
        } catch (error) {
          if (error instanceof ScraperRequestWaitError && error.resumeUrl) {
            const detailUrls = [...state.detailUrls];
            detailUrls[state.detailIndex] = error.resumeUrl.toString();
            state = { ...state, detailUrls };
            await session.checkpoint(state);
          }
          throw error;
        }
        const parsed = input.rules.parseDetail(response.body, response.url);
        if (parsed.issues.length > 0 || !parsed.value) {
          throw new ScrapeSourceParseError(
            response.url.toString(),
            parsed.issues,
          );
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
                      field: input.rules.listLinkField,
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
        !(error instanceof ScraperRequestWaitError) &&
        !(error instanceof ScraperCoordinationError) &&
        !(error instanceof ScraperRunTakenOverError)
      ) {
        await input.recordPreview({
          status: "failed",
          result: {
            issues:
              error instanceof ScrapeSourceParseError
                ? error.issues
                : [
                    {
                      field: "preview",
                      message:
                        "Preview stopped before it could finish. Check the run error, then try again.",
                    },
                  ],
            pages: state.previewPages,
          },
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
  rules: ExecutableScrapeRules;
  recordPreview: RecordScrapeSourcePreview;
}): ScraperSourceDefinition<ConfiguredScrapeCursor, unknown> {
  return {
    key: `local-preview-${input.siteKey}`,
    externalSiteKey: input.siteKey,
    recordType: input.rules.kind,
    targetKeys: [input.targetKey],
    resumeFromLastRun: false,
    cursorSchema: ConfiguredScrapeCursorSchema,
    observationSchema: observationSchemaForRules(input.rules),
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
  runId: number;
  executionToken: string;
  scrapeSourceId: number;
  revisionId: number;
  targetKey: string;
  listUrl: string;
  purpose: "collect" | "preview";
  rules: ExecutableScrapeRules;
}): ScraperSourceDefinition<ConfiguredScrapeCursor, unknown> {
  const observationSchema = observationSchemaForRules(input.rules);
  const sink: ScraperSink<unknown> =
    input.purpose === "preview"
      ? async () => {}
      : input.rules.kind === "review"
        ? async ({ externalSiteId, observation }) => {
            return await externalReviewSink({
              externalSiteId,
              observation: {
                ...observation,
                value: ExternalReviewArticleIngestionSchema.parse(
                  observation.value,
                ),
              },
            });
          }
        : input.rules.kind === "catalog"
          ? async ({ externalSiteId, observation }) => {
              return await catalogListingSink({
                externalSiteId,
                observation: {
                  ...observation,
                  value: z
                    .array(CatalogListingInputSchema)
                    .parse(observation.value),
                },
              });
            }
          : async ({ externalSiteId, observation }) => {
              return await createStorePriceSink(input.siteKey)({
                externalSiteId,
                observation: {
                  ...observation,
                  value: z
                    .array(StorePriceInputSchema)
                    .parse(observation.value),
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
              runId: input.runId,
              executionToken: input.executionToken,
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
    recordType: input.rules.kind,
    targetKeys: [input.targetKey],
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
  executionToken: string,
  requestModel?: RequestScrapeSourceModel,
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
    const target = await loadScrapeSourceTarget(suggestion.target);
    const adapter: ScraperAdapter<ScrapeSourceSuggestionCursor, unknown> =
      suggestion.run.revisionId !== null
        ? // A linked revision means the suggestion finished before the run was retried.
          async () => {}
        : async ({ cursor, session }) => {
            const repair = cursor?.repair;
            if (!requestedById && !repair) {
              throw new Error("AI suggestion run has no requesting admin.");
            }

            if (repair) {
              const [current] = await db
                .select({
                  enabled: scrapeSources.enabled,
                  revisionId: scrapeSourceRevisions.id,
                })
                .from(scrapeSources)
                .leftJoin(
                  scrapeSourceRevisions,
                  and(
                    eq(scrapeSourceRevisions.scrapeSourceId, scrapeSources.id),
                    eq(scrapeSourceRevisions.active, true),
                  ),
                )
                .where(eq(scrapeSources.id, suggestion.source.id));
              if (
                !current?.enabled ||
                current.revisionId !== repair.revisionId
              ) {
                return;
              }
            }

            const entryUrl = new URL(suggestion.source.listUrl).toString();
            const failureResponse = repair
              ? await session.request({
                  target: target.key,
                  url: new URL(repair.pageUrl),
                })
              : null;
            const entryResponse =
              failureResponse?.url.toString() === entryUrl
                ? failureResponse
                : await session.request({
                    target: target.key,
                    url: new URL(entryUrl),
                  });
            const sampleUrls = new Set(
              suggestion.source.sampleUrls.map((value) =>
                new URL(value).toString(),
              ),
            );
            const entryFeed =
              suggestion.source.kind === "review"
                ? inspectSyndicationFeed({
                    pageUrl: entryResponse.url,
                    xml: entryResponse.body,
                  })
                : null;
            const listPages = [
              {
                url: entryResponse.url.toString(),
                html: entryResponse.body,
                document: entryFeed ? ("xml" as const) : ("html" as const),
              },
            ];
            const advertisedFeeds =
              suggestion.source.kind === "review" && !entryFeed
                ? findAdvertisedSyndicationPages({
                    pageUrl: entryResponse.url,
                    html: entryResponse.body,
                  })
                : [];
            const advertisedFeedSet = new Set(advertisedFeeds);
            const likelyListPages = [
              ...advertisedFeeds,
              ...findLikelyListPages({
                kind: suggestion.source.kind,
                pageUrl: entryResponse.url,
                html: entryResponse.body,
              }),
            ]
              .filter(
                (value, index, values) =>
                  !sampleUrls.has(value) && values.indexOf(value) === index,
              )
              .slice(0, MAX_LIKELY_LIST_PAGES);
            for (const value of likelyListPages) {
              try {
                const response = await session.request({
                  target: target.key,
                  url: new URL(value),
                });
                const advertisedFeed = advertisedFeedSet.has(value);
                if (
                  advertisedFeed &&
                  !inspectSyndicationFeed({
                    pageUrl: response.url,
                    xml: response.body,
                  })
                ) {
                  continue;
                }
                listPages.push({
                  url: response.url.toString(),
                  html: response.body,
                  document: advertisedFeed
                    ? ("xml" as const)
                    : ("html" as const),
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
              const response =
                failureResponse?.url.toString() === value
                  ? failureResponse
                  : await session.request({
                      target: target.key,
                      url: new URL(value),
                    });
              detailPages.push({
                url: response.url.toString(),
                html: response.body,
                document: "html" as const,
              });
            }
            const suppliedDetailUrls = new Set(
              detailPages.map((page) => new URL(page.url).toString()),
            );
            const likelyDetailPages = findLikelyDetailPages({
              kind: suggestion.source.kind,
              limit: MAX_EXAMPLE_PAGES,
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
                  document: "html" as const,
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
            await suggestScrapeSourceRevision(
              {
                scrapeSourceId: suggestion.source.id,
                externalSiteRunId: runId,
                executionToken,
                createdById: requestedById ?? undefined,
                listPages,
                detailPages,
                failure:
                  repair && failureResponse
                    ? {
                        url: failureResponse.url.toString(),
                        html: failureResponse.body,
                        document: "html",
                        issues: repair.issues,
                      }
                    : undefined,
                loadPage: async (url) => {
                  const response = await session.request({
                    target: target.key,
                    url,
                  });
                  return {
                    url: response.url.toString(),
                    html: response.body,
                    document: "html" as const,
                  };
                },
              },
              requestModel,
            );
          };
    const source: ScraperSourceDefinition<
      ScrapeSourceSuggestionCursor,
      unknown
    > = {
      key: `source-${suggestion.source.id}`,
      externalSiteKey: suggestion.siteKey,
      targetKeys: [target.key],
      resumeFromLastRun: false,
      cursorSchema: ScrapeSourceSuggestionCursorSchema,
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

  const rules = loadExecutableScrapeRules(
    row.revision.rulesVersion,
    row.revision.rules,
  );
  if (row.run.purpose === "suggest") {
    throw new Error("An AI run cannot use saved rules.");
  }
  if (rules.kind !== row.source.kind) {
    throw new Error("The rules collect the wrong content.");
  }
  const target = await loadScrapeSourceTarget(row.target);
  const source = createScrapeSourceDefinition({
    siteKey: row.siteKey,
    runId,
    executionToken,
    scrapeSourceId: row.source.id,
    revisionId: row.revision.id,
    targetKey: target.key,
    listUrl: row.revision.listUrl,
    purpose: row.run.purpose,
    rules,
  });
  return registryForSource(baseRegistry, source, target);
}
