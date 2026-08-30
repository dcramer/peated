import { db } from "@peated/server/db";
import {
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  users,
} from "@peated/server/db/schema";
import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { and, eq } from "drizzle-orm";
import { createScraperRegistry } from "../definitions";
import { executeScraperRun } from "../runs";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import { ScrapeSourcePreviewResultSchema } from "./preview";
import { parseScrapeRules } from "./rules";
import {
  createPinnedScrapeSourceRun,
  createScrapeSourceSuggestionRun,
} from "./runs";
import { createSiteWithScrapeSource } from "./service";

const SITE_ORIGIN = "https://review-fixture.test";
const HOME_URL = `${SITE_ORIGIN}/`;
const LIST_URL = `${SITE_ORIGIN}/reviews`;
const SECOND_LIST_URL = `${SITE_ORIGIN}/reviews?page=2`;
const FIRST_REVIEW_URL = `${SITE_ORIGIN}/reviews/autumn-notes`;
const SECOND_REVIEW_URL = `${SITE_ORIGIN}/reviews/island-notes`;
const THIRD_REVIEW_URL = `${SITE_ORIGIN}/reviews/highland-notes`;

const WEBSITE_PAGES = new Map([
  [
    HOME_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <h1>Review Fixture</h1>
            <a href="/about">About</a>
            <a href="/reviews">All whisky reviews</a>
          </main>
        </body>
      </html>`,
  ],
  [
    LIST_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <h1>Latest whisky reviews</h1>
            <article class="review-card">
              <h2>Autumn bottle notes</h2>
              <a class="review-card__link" href="/reviews/autumn-notes">Read reviews</a>
            </article>
            <article class="review-card">
              <h2>Island bottle notes</h2>
              <a class="review-card__link" href="/reviews/island-notes">Read reviews</a>
            </article>
            <nav aria-label="Review pages">
              <a class="pagination-next" href="/reviews?page=2">Next</a>
            </nav>
          </main>
        </body>
      </html>`,
  ],
  [
    SECOND_LIST_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <h1>Earlier whisky reviews</h1>
            <article class="review-card">
              <h2>Highland bottle notes</h2>
              <a class="review-card__link" href="/reviews/highland-notes">Read reviews</a>
            </article>
          </main>
        </body>
      </html>`,
  ],
  [
    FIRST_REVIEW_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <article class="review-article">
              <header>
                <h1 class="article-title">Autumn bottle notes</h1>
                <time class="published-date" datetime="2026-08-20">August 20, 2026</time>
              </header>
              <section class="bottle-review">
                <h2 class="bottle-name">North Coast 12 Year</h2>
                <p>Reviewed by <span class="reviewer-name">Mara Vale</span></p>
                <p>Score: <span class="review-score">91 / 100</span></p>
                <p class="review-notes">Orange peel, toasted grain, and a dry finish.</p>
              </section>
              <section class="bottle-review">
                <h2 class="bottle-name">Harbor Blend Batch 4</h2>
                <p>Reviewed by <span class="reviewer-name">Jon Bell</span></p>
                <p>Score: <span class="review-score">87 / 100</span></p>
                <p class="review-notes">Honey, pepper, and soft oak.</p>
              </section>
            </article>
          </main>
        </body>
      </html>`,
  ],
  [
    SECOND_REVIEW_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <article class="review-article">
              <header>
                <h1 class="article-title">Island bottle notes</h1>
                <time class="published-date" datetime="2026-08-27">August 27, 2026</time>
              </header>
              <section class="bottle-review">
                <h2 class="bottle-name">West Isle Peated Malt</h2>
                <p>Reviewed by <span class="reviewer-name">Mara Vale</span></p>
                <p>Score: <span class="review-score">93 / 100</span></p>
                <p class="review-notes">Coastal smoke, lemon oil, and mineral notes.</p>
              </section>
            </article>
          </main>
        </body>
      </html>`,
  ],
  [
    THIRD_REVIEW_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <article class="review-article">
              <header>
                <h1 class="article-title">Highland bottle notes</h1>
                <time class="published-date" datetime="2026-08-13">August 13, 2026</time>
              </header>
              <section class="bottle-review">
                <h2 class="bottle-name">Hill Farm 10 Year</h2>
                <p>Reviewed by <span class="reviewer-name">Jon Bell</span></p>
                <p>Score: <span class="review-score">89 / 100</span></p>
                <p class="review-notes">Apple skin, malt, and gentle spice.</p>
              </section>
            </article>
          </main>
        </body>
      </html>`,
  ],
]);

function getFixtureHtml(url: string) {
  const html = WEBSITE_PAGES.get(url);
  if (html === undefined) {
    throw new Error(`Missing fixture page: ${url}`);
  }
  return html;
}

function createFixtureWebsite() {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requests.push(url.toString());
    const html = WEBSITE_PAGES.get(url.toString());
    if (html === undefined) {
      throw new Error(`Unexpected fixture website request: ${url.toString()}`);
    }
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
      status: 200,
    });
  };
  return { fetchImpl, requests };
}

describe.skipIf(!isAIGatewayConfigured("scraper"))(
  "review rule suggestion eval",
  () => {
    test("generated selectors extract the exact review fields", async () => {
      const [admin] = await db
        .insert(users)
        .values({
          admin: true,
          email: "scraper-eval@example.com",
          username: "scraper-eval",
        })
        .returning();
      if (!admin) throw new Error("Failed to create eval admin.");

      const { site, source } = await createSiteWithScrapeSource({
        createdById: admin.id,
        kind: "review",
        websiteUrl: HOME_URL,
        name: "Review Fixture",
        sampleUrls: [],
      });
      await db
        .update(scrapeOrigins)
        .set({
          robotsMode: "not_applicable",
          robotsRationale: "Reserved test origin has no network operator.",
        })
        .where(eq(scrapeOrigins.origin, SITE_ORIGIN));

      const fixtureWebsite = createFixtureWebsite();
      const registry = createScraperRegistry({ sources: [], targets: [] });
      const suggestionRun = await createScrapeSourceSuggestionRun({
        requestedById: admin.id,
        scrapeSourceId: source.id,
      });
      await expect(
        executeScraperRun(
          { runId: suggestionRun.id },
          { fetchImpl: fixtureWebsite.fetchImpl, registry },
        ),
      ).resolves.toEqual({ status: "completed" });

      const [suggestedRevision] = await db
        .select()
        .from(scrapeSourceRevisions)
        .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id));
      expect(suggestedRevision).toMatchObject({
        aiInstructionsVersion: "scrape-source-v6",
        author: "ai",
        listUrl: LIST_URL,
        previewStatus: "pending",
      });
      if (!suggestedRevision) throw new Error("AI did not create a revision.");
      expect(suggestedRevision.aiModel).toBeTruthy();
      expect(suggestedRevision.rules).toMatchObject({
        kind: "review",
        list: { nextPage: expect.any(Object) },
        detail: {
          publishedAt: expect.any(Object),
          reviewerName: expect.any(Object),
          reviewText: expect.any(Object),
          score: expect.any(Object),
        },
      });

      const rules = parseScrapeRules(
        suggestedRevision.rulesVersion,
        suggestedRevision.rules,
      );
      const listResult = parseScrapeList(
        rules,
        getFixtureHtml(LIST_URL),
        new URL(LIST_URL),
      );
      expect(listResult).toEqual({
        issues: [],
        links: [FIRST_REVIEW_URL, SECOND_REVIEW_URL],
        nextPageUrl: SECOND_LIST_URL,
      });
      const parsedPages = [
        FIRST_REVIEW_URL,
        SECOND_REVIEW_URL,
        THIRD_REVIEW_URL,
      ].map((url) => {
        const result = parseScrapeDetail(
          rules,
          getFixtureHtml(url),
          new URL(url),
        );
        expect(result.issues).toEqual([]);
        if (result.kind !== "review" || !result.value) {
          throw new Error("Generated rules did not parse a review page.");
        }
        const value = result.value;
        return {
          title: value.article.title,
          publishedAt: value.article.publishedAt?.toISOString() ?? null,
          reviews: value.article.externalReviews.map((review) => ({
            name: review.name,
            reviewerName: review.reviewerName,
            nativeScore: review.nativeScore,
            reviewText: value.reviewTextByKey[review.sourceKey] ?? null,
          })),
        };
      });
      expect(parsedPages).toEqual([
        {
          title: "Autumn bottle notes",
          publishedAt: "2026-08-20T00:00:00.000Z",
          reviews: [
            {
              name: "North Coast 12 Year",
              reviewerName: "Mara Vale",
              nativeScore: { display: "91 / 100", scale: 100, value: 91 },
              reviewText: "Orange peel, toasted grain, and a dry finish.",
            },
            {
              name: "Harbor Blend Batch 4",
              reviewerName: "Jon Bell",
              nativeScore: { display: "87 / 100", scale: 100, value: 87 },
              reviewText: "Honey, pepper, and soft oak.",
            },
          ],
        },
        {
          title: "Island bottle notes",
          publishedAt: "2026-08-27T00:00:00.000Z",
          reviews: [
            {
              name: "West Isle Peated Malt",
              reviewerName: "Mara Vale",
              nativeScore: { display: "93 / 100", scale: 100, value: 93 },
              reviewText: "Coastal smoke, lemon oil, and mineral notes.",
            },
          ],
        },
        {
          title: "Highland bottle notes",
          publishedAt: "2026-08-13T00:00:00.000Z",
          reviews: [
            {
              name: "Hill Farm 10 Year",
              reviewerName: "Jon Bell",
              nativeScore: { display: "89 / 100", scale: 100, value: 89 },
              reviewText: "Apple skin, malt, and gentle spice.",
            },
          ],
        },
      ]);

      const [suggestionLink] = await db
        .select()
        .from(scrapeSourceRuns)
        .where(
          and(
            eq(scrapeSourceRuns.externalSiteRunId, suggestionRun.id),
            eq(scrapeSourceRuns.revisionId, suggestedRevision.id),
          ),
        );
      expect(suggestionLink).toBeDefined();

      const previewRun = await createPinnedScrapeSourceRun(db, {
        externalSiteId: site.id,
        purpose: "preview",
        requestedById: admin.id,
        revisionId: suggestedRevision.id,
        scrapeSourceId: source.id,
        trigger: "manual",
      });
      await expect(
        executeScraperRun(
          { runId: previewRun.run.id },
          { fetchImpl: fixtureWebsite.fetchImpl, registry },
        ),
      ).resolves.toEqual({ status: "completed" });

      const [previewedRevision] = await db
        .select()
        .from(scrapeSourceRevisions)
        .where(eq(scrapeSourceRevisions.id, suggestedRevision.id));
      expect(previewedRevision?.previewStatus).toBe("passed");
      const preview = ScrapeSourcePreviewResultSchema.parse(
        previewedRevision?.previewResult,
      );
      expect(preview.issues).toEqual([]);
      expect(preview.pages).toHaveLength(3);
      expect(fixtureWebsite.requests).toEqual([
        HOME_URL,
        LIST_URL,
        FIRST_REVIEW_URL,
        SECOND_REVIEW_URL,
        SECOND_LIST_URL,
        THIRD_REVIEW_URL,
        LIST_URL,
        SECOND_LIST_URL,
        FIRST_REVIEW_URL,
        SECOND_REVIEW_URL,
        THIRD_REVIEW_URL,
      ]);
    });
  },
);
