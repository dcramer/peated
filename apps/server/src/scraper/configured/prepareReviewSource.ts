import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeSources,
  scrapeTargets,
} from "@peated/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  ScrapeSourceConflictError,
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
} from "./service";

const InputSchema = z
  .object({
    apply: z.boolean().default(false),
    createdById: z.number().int().positive(),
  })
  .strict();

export type PrepareReviewSourceInput = z.input<typeof InputSchema>;

type ReviewSourceDefinition = {
  siteKey: string;
  siteName: string;
  targetKey: string;
  origin: string;
  listUrl: string;
  isCanonicalArticleUrl: (url: string) => boolean;
  legacyReviewKey: (url: string) => string;
};

/** Checks one single-review source by default; applying preserves records and leaves collection paused. */
export async function prepareReviewSource(
  input: PrepareReviewSourceInput,
  definition: ReviewSourceDefinition,
) {
  const { apply, createdById } = InputSchema.parse(input);
  return db.transaction(async (tx) => {
    // The scraper lifecycle also locks this site before choosing its scraper.
    const [site] = await tx
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, definition.siteKey))
      .for("update");
    if (!site) {
      throw new ScrapeSourceNotFoundError(
        `${definition.siteName} was not found.`,
      );
    }
    if (site.runEvery !== null) {
      throw new ScrapeSourceConflictError(
        `Stop the ${definition.siteName} schedule before continuing.`,
      );
    }
    const [activeRun] = await tx
      .select({ id: externalSiteRuns.id })
      .from(externalSiteRuns)
      .where(
        and(
          eq(externalSiteRuns.externalSiteId, site.id),
          inArray(externalSiteRuns.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (activeRun) {
      throw new ScrapeSourceConflictError(
        `Wait for the active ${definition.siteName} run to finish.`,
      );
    }
    const [source] = await tx
      .select({ id: scrapeSources.id })
      .from(scrapeSources)
      .where(eq(scrapeSources.externalSiteId, site.id));
    if (source) {
      throw new ScrapeSourceConflictError(
        `${definition.siteName} is already prepared for saved scraping rules.`,
      );
    }

    const siteTargets = await tx
      .select()
      .from(externalSiteScrapeTargets)
      .where(eq(externalSiteScrapeTargets.externalSiteId, site.id))
      .for("update");
    const targetSites = await tx
      .select()
      .from(externalSiteScrapeTargets)
      .where(eq(externalSiteScrapeTargets.targetKey, definition.targetKey))
      .for("update");
    const origins = await tx
      .select()
      .from(scrapeOrigins)
      .where(eq(scrapeOrigins.targetKey, definition.targetKey))
      .for("update");
    const [target] = await tx
      .select()
      .from(scrapeTargets)
      .where(eq(scrapeTargets.key, definition.targetKey))
      .for("update");
    // This operation handles only the review source's own request settings.
    if (
      siteTargets.length !== 1 ||
      siteTargets[0].targetKey !== definition.targetKey ||
      !siteTargets[0].active ||
      siteTargets[0].managedBy !== "code" ||
      targetSites.length !== 1 ||
      targetSites[0].externalSiteId !== site.id ||
      origins.length !== 1 ||
      origins[0].origin !== definition.origin ||
      !origins[0].active ||
      origins[0].managedBy !== "code" ||
      origins[0].robotsMode !== "enforce" ||
      !target?.enabled ||
      target.managedBy !== "code"
    ) {
      throw new ScrapeSourceValidationError(
        `${definition.siteName} has unexpected request settings. Check them before continuing.`,
      );
    }

    const articles = await tx
      .select({
        id: externalReviewArticles.id,
        url: externalReviewArticles.canonicalUrl,
      })
      .from(externalReviewArticles)
      .where(eq(externalReviewArticles.externalSiteId, site.id))
      .for("update");
    const reviews = await tx
      .select({
        id: externalReviews.id,
        articleId: externalReviews.articleId,
        sourceKey: externalReviews.sourceKey,
      })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviewArticles.id, externalReviews.articleId),
      )
      .where(eq(externalReviewArticles.externalSiteId, site.id))
      .for("update");
    const reviewsByArticle = new Map<number, typeof reviews>();
    for (const review of reviews) {
      const group = reviewsByArticle.get(review.articleId) ?? [];
      group.push(review);
      reviewsByArticle.set(review.articleId, group);
    }
    const changes = articles.map((article) => {
      const articleReviews = reviewsByArticle.get(article.id) ?? [];
      // Review imports own these keys. One verified review per article avoids guessing.
      if (
        !definition.isCanonicalArticleUrl(article.url) ||
        articleReviews.length !== 1 ||
        articleReviews[0].sourceKey !== definition.legacyReviewKey(article.url)
      ) {
        throw new ScrapeSourceValidationError(
          `Check the URL and review records for ${definition.siteName} article ${article.id} before continuing.`,
        );
      }
      return { id: articleReviews[0].id, sourceKey: `${article.url}#review-1` };
    });

    let scrapeSourceId: number | null = null;
    if (apply) {
      for (const change of changes) {
        await tx
          .update(externalReviews)
          .set({ sourceKey: change.sourceKey })
          .where(eq(externalReviews.id, change.id));
      }
      await tx
        .update(externalSiteScrapeTargets)
        .set({ managedBy: "admin", updatedAt: new Date() })
        .where(
          and(
            eq(externalSiteScrapeTargets.externalSiteId, site.id),
            eq(externalSiteScrapeTargets.targetKey, definition.targetKey),
          ),
        );
      await tx
        .update(scrapeOrigins)
        .set({ managedBy: "admin", updatedAt: new Date() })
        .where(eq(scrapeOrigins.origin, definition.origin));
      await tx
        .update(scrapeTargets)
        .set({ managedBy: "admin", updatedAt: new Date() })
        .where(eq(scrapeTargets.key, definition.targetKey));
      const [created] = await tx
        .insert(scrapeSources)
        .values({
          externalSiteId: site.id,
          kind: "review",
          listUrl: definition.listUrl,
          createdById,
        })
        .returning({ id: scrapeSources.id });
      if (!created) throw new Error("Failed to prepare the scrape source.");
      scrapeSourceId = created.id;
    }
    return {
      siteId: site.id,
      scrapeSourceId,
      reviewCount: changes.length,
      applied: apply,
    };
  });
}
