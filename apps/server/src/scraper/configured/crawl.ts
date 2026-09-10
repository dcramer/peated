import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import {
  CatalogListingInputSchema,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { ScraperCoordinationError } from "../coordinator";
import { ScraperRequestWaitError } from "../http";
import { ScraperRunTakenOverError } from "../session";
import type { ScraperAdapter, ScraperObservation } from "../types";
import type { ExecutableScrapeRules } from "./compatibility";
import {
  ScrapeSourcePreviewPageSchema,
  type ScrapeIssue,
  type ScrapeSourcePreviewPage,
} from "./preview";
import { SCRAPE_SOURCE_MAX_LIST_PAGES } from "./rules";

export class ScrapeSourceParseError extends Error {
  override name = "ScrapeSourceParseError";

  constructor(
    readonly pageUrl: string,
    readonly issues: ScrapeIssue[],
  ) {
    super("The page did not match the saved rules.");
  }
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

export type RecordScrapeSourcePreview = (input: {
  status: "passed" | "failed";
  result: {
    issues: ScrapeIssue[];
    pages: ScrapeSourcePreviewPage[];
  };
}) => Promise<void>;

export const ConfiguredScrapeCursorSchema = z
  .object({
    listUrls: z.array(z.url()).max(SCRAPE_SOURCE_MAX_LIST_PAGES),
    detailUrls: z.array(z.url()).max(99),
    nextListUrl: z.url().nullable(),
    detailIndex: z.number().int().min(0).max(99),
    previewPages: z.array(ScrapeSourcePreviewPageSchema).max(99),
  })
  .strict();

export type ConfiguredScrapeCursor = z.infer<
  typeof ConfiguredScrapeCursorSchema
>;

export function observationSchemaForRules(rules: ExecutableScrapeRules) {
  if (rules.kind === "review") return ExternalReviewArticleIngestionSchema;
  if (rules.kind === "catalog") return z.array(CatalogListingInputSchema);
  return z.array(StorePriceInputSchema);
}

export function createScrapeSourceAdapter(
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
