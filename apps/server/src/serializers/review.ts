import { and, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import {
  bottles,
  bottleTombstones,
  externalReviewSourcePolicies,
  externalSites,
  reviewArticles,
  type ExternalReviewSourcePolicy,
  type Review,
  type ReviewArticle,
  type User,
} from "../db/schema";
import { type BottleSchema, type ReviewSchema } from "../schemas";
import { BottleSerializer } from "./bottle";
import { ExternalSiteSerializer } from "./externalSite";

type ReviewAttrs = {
  article: Pick<
    ReviewArticle,
    "canonicalUrl" | "contentHash" | "externalSiteId" | "publishedAt" | "title"
  >;
  bottle: z.infer<typeof BottleSchema> | null;
  policy: Pick<
    ExternalReviewSourcePolicy,
    "allowLlmProcessing" | "allowScoreDisplay" | "allowSummaryDisplay"
  > | null;
  site: ReturnType<(typeof ExternalSiteSerializer)["item"]>;
};

export const ReviewSerializer = serializer({
  name: "review",
  attrs: async (
    itemList: Review[],
    currentUser?: User,
  ): Promise<Record<string, ReviewAttrs>> => {
    const articleIds = Array.from(
      new Set(
        itemList.map((review) => {
          if (review.articleId === null) {
            throw new Error(`Review ${review.id} has no article.`);
          }
          return review.articleId;
        }),
      ),
    );
    const articleList = await db
      .select({
        id: reviewArticles.id,
        canonicalUrl: reviewArticles.canonicalUrl,
        contentHash: reviewArticles.contentHash,
        externalSiteId: reviewArticles.externalSiteId,
        publishedAt: reviewArticles.publishedAt,
        title: reviewArticles.title,
      })
      .from(reviewArticles)
      .where(inArray(reviewArticles.id, articleIds));
    const articlesById = new Map(
      articleList.map((article) => [article.id, article]),
    );

    const bottleIds = Array.from(
      new Set(
        itemList.flatMap(({ bottleId }) =>
          bottleId === null ? [] : [bottleId],
        ),
      ),
    );
    const bottleList = bottleIds.length
      ? await db
          .select()
          .from(bottles)
          .where(
            and(
              inArray(bottles.id, bottleIds),
              sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
            ),
          )
      : [];
    const serializedBottles = await serialize(
      BottleSerializer,
      bottleList,
      currentUser,
    );
    const bottlesById = new Map(
      serializedBottles.map((bottle) => [bottle.id, bottle]),
    );

    const siteIds = Array.from(
      new Set(articleList.map((article) => article.externalSiteId)),
    );
    const siteList = siteIds.length
      ? await db
          .select()
          .from(externalSites)
          .where(inArray(externalSites.id, siteIds))
      : [];
    const policyList = siteIds.length
      ? await db
          .select()
          .from(externalReviewSourcePolicies)
          .where(inArray(externalReviewSourcePolicies.externalSiteId, siteIds))
      : [];
    const policiesBySiteId = new Map(
      policyList.map((policy) => [policy.externalSiteId, policy]),
    );
    const sitesByRef = Object.fromEntries(
      (await serialize(ExternalSiteSerializer, siteList, currentUser)).map(
        (data, index) => [siteList[index].id, data],
      ),
    );

    return Object.fromEntries(
      itemList.map((item) => {
        const article = articlesById.get(item.articleId!);
        if (!article) {
          throw new Error(
            `Review ${item.id} references missing article ${item.articleId}.`,
          );
        }
        const bottle =
          item.bottleId === null
            ? null
            : (bottlesById.get(item.bottleId) ?? null);
        if (item.bottleId !== null && bottle === null) {
          throw new Error(
            `Review ${item.id} references missing Bottle ${item.bottleId}.`,
          );
        }
        return [
          item.id,
          {
            article,
            bottle,
            policy: policiesBySiteId.get(article.externalSiteId) ?? null,
            site: sitesByRef[article.externalSiteId],
          },
        ];
      }),
    );
  },

  item: (
    item: Review,
    attrs: ReviewAttrs,
    currentUser?: User,
  ): z.infer<typeof ReviewSchema> => {
    // This serializer owns the final display-capability check so every API
    // consumer receives the same permitted view after policy revocation.
    const nativeScore =
      attrs.policy?.allowScoreDisplay &&
      item.nativeScoreValue !== null &&
      item.nativeScoreScale !== null &&
      item.nativeScoreDisplay !== null
        ? {
            value: item.nativeScoreValue,
            scale: item.nativeScoreScale,
            display: item.nativeScoreDisplay,
          }
        : null;
    const summary =
      attrs.policy?.allowLlmProcessing &&
      attrs.policy.allowSummaryDisplay &&
      attrs.article.contentHash !== null &&
      attrs.article.contentHash === item.summaryContentHash
        ? item.summary
        : null;

    return {
      id: item.id,
      name: item.name,
      rating: item.rating,
      url: attrs.article.canonicalUrl,
      article: {
        title: attrs.article.title,
        publishedAt: attrs.article.publishedAt?.toISOString() ?? null,
      },
      bottle: attrs.bottle,
      reviewerName: item.reviewerName,
      nativeScore,
      summary,
      site: attrs.site,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
