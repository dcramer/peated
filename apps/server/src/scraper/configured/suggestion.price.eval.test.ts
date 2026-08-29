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

const SITE_ORIGIN = "https://price-fixture.test";
const HOME_URL = `${SITE_ORIGIN}/`;
const LIST_URL = `${SITE_ORIGIN}/shop`;
const FIRST_PRODUCT_URL = `${SITE_ORIGIN}/products/coastal-12`;
const SECOND_PRODUCT_URL = `${SITE_ORIGIN}/products/orchard-blend`;

const WEBSITE_PAGES = new Map([
  [
    HOME_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main>
            <h1>Price Fixture</h1>
            <a href="/about">About</a>
            <a href="/shop">Shop all whisky</a>
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
            <h1>Whisky shop</h1>
            <article class="product-card">
              <h2>Coastal 12 Year</h2>
              <a class="product-card__link" href="/products/coastal-12">View product</a>
            </article>
            <article class="product-card">
              <h2>Orchard Blend</h2>
              <a class="product-card__link" href="/products/orchard-blend">View product</a>
            </article>
          </main>
        </body>
      </html>`,
  ],
  [
    FIRST_PRODUCT_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main class="product-page">
            <h1 class="product-title">Coastal 12 Year</h1>
            <p class="product-price">$84.99</p>
            <p class="product-volume">750 ml</p>
            <span class="product-sku">COASTAL-12-750</span>
            <img class="product-image" src="https://price-fixture.test/images/coastal-12.jpg" alt="Coastal 12 Year bottle">
          </main>
        </body>
      </html>`,
  ],
  [
    SECOND_PRODUCT_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main class="product-page">
            <h1 class="product-title">Orchard Blend</h1>
            <p class="product-price">$129.50</p>
            <p class="product-volume">70 cl</p>
            <span class="product-sku">ORCHARD-70</span>
            <img class="product-image" src="https://price-fixture.test/images/orchard-blend.jpg" alt="Orchard Blend bottle">
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
  "price rule suggestion eval",
  () => {
    test("generated selectors extract the exact price fields", async () => {
      const [admin] = await db
        .insert(users)
        .values({
          admin: true,
          email: "price-scraper-eval@example.com",
          username: "price-scraper-eval",
        })
        .returning();
      if (!admin) throw new Error("Failed to create eval admin.");

      const { site, source } = await createSiteWithScrapeSource({
        allowAiSuggestions: true,
        createdById: admin.id,
        kind: "price",
        websiteUrl: HOME_URL,
        name: "Price Fixture",
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
        aiInstructionsVersion: "scrape-source-v3",
        author: "ai",
        listUrl: LIST_URL,
        previewStatus: "pending",
      });
      if (!suggestedRevision) throw new Error("AI did not create a revision.");
      expect(suggestedRevision.aiModel).toBeTruthy();
      expect(suggestedRevision.rules).toMatchObject({
        kind: "price",
        detail: {
          externalProductId: expect.any(Object),
          imageUrl: expect.any(Object),
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
        links: [FIRST_PRODUCT_URL, SECOND_PRODUCT_URL],
      });
      const parsedPages = [FIRST_PRODUCT_URL, SECOND_PRODUCT_URL].map((url) => {
        const result = parseScrapeDetail(
          rules,
          getFixtureHtml(url),
          new URL(url),
        );
        expect(result.issues).toEqual([]);
        if (result.kind !== "price") {
          throw new Error("Generated rules did not parse a price page.");
        }
        return result.value;
      });
      expect(parsedPages).toEqual([
        [
          {
            currency: "usd",
            externalProductId: "COASTAL-12-750",
            imageUrl: "https://price-fixture.test/images/coastal-12.jpg",
            name: "Coastal 12 Year",
            price: 8499,
            url: FIRST_PRODUCT_URL,
            volume: 750,
          },
        ],
        [
          {
            currency: "usd",
            externalProductId: "ORCHARD-70",
            imageUrl: "https://price-fixture.test/images/orchard-blend.jpg",
            name: "Orchard Blend",
            price: 12950,
            url: SECOND_PRODUCT_URL,
            volume: 700,
          },
        ],
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
      expect(preview.pages).toHaveLength(2);
      expect(fixtureWebsite.requests).toEqual([
        HOME_URL,
        LIST_URL,
        FIRST_PRODUCT_URL,
        SECOND_PRODUCT_URL,
        LIST_URL,
        FIRST_PRODUCT_URL,
        SECOND_PRODUCT_URL,
      ]);
    });
  },
);
