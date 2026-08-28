import { db } from "@peated/server/db";
import {
  configuredScraperConfigVersions,
  configuredScraperRuns,
  configuredScrapers,
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
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
import {
  type ConfiguredScraperConfig,
  ConfiguredScraperConfigSchema,
} from "./config";
import { generateConfiguredScraperDraft } from "./generator";
import { parseConfiguredDetail, parseConfiguredIndex } from "./parser";
import { recordConfiguredScraperValidation } from "./service";
import { loadConfiguredTarget } from "./target";
import type {
  ConfiguredParseIssue,
  ConfiguredScraperPreviewPage,
} from "./validation";

export class ConfiguredScraperParseError extends Error {
  override name = "ConfiguredScraperParseError";

  constructor(readonly issues: ConfiguredParseIssue[]) {
    super("The page did not match the saved parsing rules.");
  }
}

function createPreviewPage(
  observation: ScraperObservation<unknown>,
  collection: "reviews" | "store_prices",
  url: string,
): ConfiguredScraperPreviewPage {
  if (collection === "reviews") {
    const value = ExternalReviewArticleIngestionSchema.parse(observation.value);
    return {
      collection,
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
    collection,
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

function createConfiguredAdapter(input: {
  targetKey: string;
  indexUrl: string;
  configVersionId: number;
  config: ConfiguredScraperConfig;
  purpose: "collect" | "preview";
}): ScraperAdapter<null, unknown> {
  return async ({ session }) => {
    const pages: ConfiguredScraperPreviewPage[] = [];
    const indexUrl = new URL(input.indexUrl);
    try {
      const indexResponse = await session.request({
        target: input.targetKey,
        url: indexUrl,
      });
      const indexResult = parseConfiguredIndex(
        input.config,
        indexResponse.body,
        indexResponse.url,
      );
      if (indexResult.issues.length > 0) {
        throw new ConfiguredScraperParseError(indexResult.issues);
      }

      for (const link of indexResult.links) {
        const response = await session.request({
          target: input.targetKey,
          url: new URL(link),
        });
        const parsed = parseConfiguredDetail(
          input.config,
          response.body,
          response.url,
        );
        if (parsed.issues.length > 0 || !parsed.value) {
          throw new ConfiguredScraperParseError(parsed.issues);
        }
        const observation = {
          sourceKey: response.url.toString(),
          value: parsed.value,
          itemCount:
            parsed.collection === "reviews"
              ? parsed.value.article.externalReviews.length
              : parsed.value.length,
        };
        if (input.purpose === "preview") {
          pages.push(
            createPreviewPage(
              observation,
              parsed.collection,
              response.url.toString(),
            ),
          );
        } else {
          await session.emit(observation);
        }
      }

      if (input.purpose === "preview") {
        await recordConfiguredScraperValidation({
          configVersionId: input.configVersionId,
          status: pages.length > 0 ? "passed" : "failed",
          result: {
            issues:
              pages.length > 0
                ? []
                : [
                    {
                      field: "index.itemLink",
                      message: "No pages produced valid output.",
                    },
                  ],
            pages,
          },
        });
      }
    } catch (error) {
      if (error instanceof ConfiguredScraperParseError) {
        await recordConfiguredScraperValidation({
          configVersionId: input.configVersionId,
          status: "failed",
          result: { issues: error.issues, pages },
        });
      }
      throw error;
    }
  };
}

function configuredSource(input: {
  siteKey: string;
  configuredScraperId: number;
  configVersionId: number;
  targetKey: string;
  indexUrl: string;
  purpose: "collect" | "preview";
  config: ConfiguredScraperConfig;
}): ScraperSourceDefinition<null, unknown> {
  const observationSchema =
    input.config.collection === "reviews"
      ? ExternalReviewArticleIngestionSchema
      : z.array(StorePriceInputSchema);
  const sink: ScraperSink<unknown> =
    input.purpose === "preview"
      ? async () => {}
      : input.config.collection === "reviews"
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
    key: `configured-${input.configuredScraperId}`,
    externalSiteKey: input.siteKey,
    targetKeys: [input.targetKey],
    requestLimit: input.config.index.maxItems + 1,
    resumeFromLastRun: false,
    cursorSchema: z.null(),
    observationSchema,
    adapter: createConfiguredAdapter(input),
    sink,
  };
}

/** Adds a run's pinned database config to the code-owned runtime registry. */
export async function resolveConfiguredRunRegistry(
  runId: number,
  baseRegistry: ScraperRegistry,
): Promise<ScraperRegistry> {
  const [generation] = await db
    .select({
      run: configuredScraperRuns,
      requestedById: externalSiteRuns.requestedById,
      scraper: configuredScrapers,
      siteKey: externalSites.type,
      target: scrapeTargets,
    })
    .from(configuredScraperRuns)
    .innerJoin(
      externalSiteRuns,
      eq(externalSiteRuns.id, configuredScraperRuns.externalSiteRunId),
    )
    .innerJoin(
      configuredScrapers,
      eq(configuredScrapers.id, configuredScraperRuns.configuredScraperId),
    )
    .innerJoin(
      externalSites,
      eq(externalSites.id, configuredScrapers.externalSiteId),
    )
    .innerJoin(
      externalSiteScrapeTargets,
      and(
        eq(
          externalSiteScrapeTargets.externalSiteId,
          configuredScrapers.externalSiteId,
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
        eq(configuredScraperRuns.externalSiteRunId, runId),
        eq(configuredScraperRuns.purpose, "generate"),
      ),
    );
  if (generation) {
    const requestedById = generation.requestedById;
    if (!requestedById) {
      throw new Error("Configured generation run has no requesting admin.");
    }
    const target = await loadConfiguredTarget(generation.target);
    const source: ScraperSourceDefinition<null, unknown> = {
      key: `configured-${generation.scraper.id}`,
      externalSiteKey: generation.siteKey,
      targetKeys: [target.key],
      requestLimit: generation.scraper.sampleUrls.length + 1,
      resumeFromLastRun: false,
      cursorSchema: z.null(),
      observationSchema: z.unknown(),
      sink: async () => {},
      adapter: async ({ session }) => {
        const urls = [
          generation.scraper.indexUrl,
          ...generation.scraper.sampleUrls,
        ];
        const pages = [];
        for (const value of urls) {
          const response = await session.request({
            target: target.key,
            url: new URL(value),
          });
          pages.push({ url: response.url.toString(), html: response.body });
        }
        const version = await generateConfiguredScraperDraft({
          configuredScraperId: generation.scraper.id,
          createdById: requestedById,
          pages,
        });
        await db
          .update(configuredScraperRuns)
          .set({ configVersionId: version.id })
          .where(eq(configuredScraperRuns.externalSiteRunId, runId));
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
      run: configuredScraperRuns,
      scraper: configuredScrapers,
      version: configuredScraperConfigVersions,
      siteKey: externalSites.type,
      target: scrapeTargets,
    })
    .from(configuredScraperRuns)
    .innerJoin(
      configuredScrapers,
      eq(configuredScrapers.id, configuredScraperRuns.configuredScraperId),
    )
    .innerJoin(
      configuredScraperConfigVersions,
      eq(
        configuredScraperConfigVersions.id,
        configuredScraperRuns.configVersionId,
      ),
    )
    .innerJoin(
      externalSites,
      eq(externalSites.id, configuredScrapers.externalSiteId),
    )
    .innerJoin(
      externalSiteScrapeTargets,
      and(
        eq(
          externalSiteScrapeTargets.externalSiteId,
          configuredScrapers.externalSiteId,
        ),
        eq(externalSiteScrapeTargets.active, true),
      ),
    )
    .innerJoin(
      scrapeTargets,
      eq(scrapeTargets.key, externalSiteScrapeTargets.targetKey),
    )
    .where(eq(configuredScraperRuns.externalSiteRunId, runId));
  if (!row) return baseRegistry;

  const config = ConfiguredScraperConfigSchema.parse(row.version.config);
  if (row.run.purpose === "generate") {
    throw new Error("An AI run cannot use saved parsing rules.");
  }
  if (config.collection !== row.scraper.collection) {
    throw new Error("The parsing rules collect the wrong content.");
  }
  const target = await loadConfiguredTarget(row.target);
  const source = configuredSource({
    siteKey: row.siteKey,
    configuredScraperId: row.scraper.id,
    configVersionId: row.version.id,
    targetKey: target.key,
    indexUrl: row.scraper.indexUrl,
    purpose: row.run.purpose,
    config,
  });
  const sources = new Map(baseRegistry.sources);
  const targets = new Map(baseRegistry.targets);
  if (sources.has(source.key) || targets.has(target.key)) {
    throw new Error(
      "Configured scraper collides with a code-owned definition.",
    );
  }
  sources.set(source.key, source);
  targets.set(target.key, target);
  return { sources, targets };
}
