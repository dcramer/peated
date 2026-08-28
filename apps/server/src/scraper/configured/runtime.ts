import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
} from "@peated/server/db/schema";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { externalReviewSink } from "../sinks/externalReviews";
import { createStorePriceSink } from "../sinks/storePrices";
import type {
  ScraperAdapter,
  ScraperObservation,
  ScraperRegistry,
  ScraperSink,
  ScraperSourceDefinition,
} from "../types";
import { type ScrapeRules, parseScrapeRules } from "./config";
import { suggestScrapeSourceDraft } from "./generator";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import { recordScrapeSourceValidation } from "./service";
import { loadScrapeSourceTarget } from "./target";
import type { ScrapeIssue, ScrapeSourcePreviewPage } from "./validation";

export class ScrapeSourceParseError extends Error {
  override name = "ScrapeSourceParseError";

  constructor(readonly issues: ScrapeIssue[]) {
    super("The page did not match the saved parsing rules.");
  }
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

function createScrapeSourceAdapter(input: {
  targetKey: string;
  listUrl: string;
  revisionId: number;
  rules: ScrapeRules;
  purpose: "collect" | "preview";
}): ScraperAdapter<null, unknown> {
  return async ({ session }) => {
    const pages: ScrapeSourcePreviewPage[] = [];
    const listUrl = new URL(input.listUrl);
    try {
      const listResponse = await session.request({
        target: input.targetKey,
        url: listUrl,
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
          pages.push(
            createPreviewPage(
              observation,
              parsed.kind,
              response.url.toString(),
            ),
          );
        } else {
          await session.emit(observation);
        }
      }

      if (input.purpose === "preview") {
        await recordScrapeSourceValidation({
          revisionId: input.revisionId,
          status: pages.length > 0 ? "passed" : "failed",
          result: {
            issues:
              pages.length > 0
                ? []
                : [
                    {
                      field: "list.detailLink",
                      message: "No pages produced valid output.",
                    },
                  ],
            pages,
          },
        });
      }
    } catch (error) {
      if (error instanceof ScrapeSourceParseError) {
        await recordScrapeSourceValidation({
          revisionId: input.revisionId,
          status: "failed",
          result: { issues: error.issues, pages },
        });
      }
      throw error;
    }
  };
}

function scrapeSourceDefinition(input: {
  siteKey: string;
  scrapeSourceId: number;
  revisionId: number;
  targetKey: string;
  listUrl: string;
  purpose: "collect" | "preview";
  rules: ScrapeRules;
}): ScraperSourceDefinition<null, unknown> {
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

  return {
    key: `source-${input.scrapeSourceId}`,
    externalSiteKey: input.siteKey,
    targetKeys: [input.targetKey],
    requestLimit: input.rules.list.maxItems + 1,
    resumeFromLastRun: false,
    cursorSchema: z.null(),
    observationSchema,
    adapter: createScrapeSourceAdapter(input),
    sink,
  };
}

/** Adds a run's pinned database config to the code-owned runtime registry. */
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
    if (!requestedById) {
      throw new Error("AI suggestion run has no requesting admin.");
    }
    const target = await loadScrapeSourceTarget(suggestion.target);
    const source: ScraperSourceDefinition<null, unknown> = {
      key: `source-${suggestion.source.id}`,
      externalSiteKey: suggestion.siteKey,
      targetKeys: [target.key],
      requestLimit: suggestion.source.sampleUrls.length + 1,
      resumeFromLastRun: false,
      cursorSchema: z.null(),
      observationSchema: z.unknown(),
      sink: async () => {},
      adapter: async ({ session }) => {
        const urls = [
          suggestion.source.listUrl,
          ...suggestion.source.sampleUrls,
        ];
        const pages = [];
        for (const value of urls) {
          const response = await session.request({
            target: target.key,
            url: new URL(value),
          });
          pages.push({ url: response.url.toString(), html: response.body });
        }
        const revision = await suggestScrapeSourceDraft({
          scrapeSourceId: suggestion.source.id,
          createdById: requestedById,
          pages,
        });
        await db
          .update(scrapeSourceRuns)
          .set({ revisionId: revision.id })
          .where(eq(scrapeSourceRuns.externalSiteRunId, runId));
      },
    };
    const sources = new Map(baseRegistry.sources);
    const targets = new Map(baseRegistry.targets);
    sources.set(source.key, source);
    targets.set(target.key, target);
    return { sources, targets };
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

  const rules = parseScrapeRules(
    row.revision.formatVersion,
    row.revision.rules,
  );
  if (row.run.purpose === "suggest") {
    throw new Error("An AI run cannot use saved parsing rules.");
  }
  if (rules.kind !== row.source.kind) {
    throw new Error("The parsing rules collect the wrong content.");
  }
  const target = await loadScrapeSourceTarget(row.target);
  const source = scrapeSourceDefinition({
    siteKey: row.siteKey,
    scrapeSourceId: row.source.id,
    revisionId: row.revision.id,
    targetKey: target.key,
    listUrl: row.revision.listUrl,
    purpose: row.run.purpose,
    rules,
  });
  const sources = new Map(baseRegistry.sources);
  const targets = new Map(baseRegistry.targets);
  if (sources.has(source.key) || targets.has(target.key)) {
    throw new Error("Scrape source collides with a code-owned definition.");
  }
  sources.set(source.key, source);
  targets.set(target.key, target);
  return { sources, targets };
}
