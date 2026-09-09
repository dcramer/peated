import { db } from "@peated/server/db";
import {
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeTargets,
  users,
} from "@peated/server/db/schema";
import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { and, eq } from "drizzle-orm";
import { setTimeout as wait } from "node:timers/promises";
import { createScraperRegistry } from "../definitions";
import { executeScraperRun } from "../runs";
import { loadExecutableScrapeRules } from "./compatibility";
import { ScrapeSourcePreviewResultSchema } from "./preview";
import type { StoredScrapeRules } from "./rules";
import {
  createPinnedScrapeSourceRun,
  createScrapeSourceSuggestionRun,
} from "./runs";
import { createSiteWithScrapeSource } from "./service";
import { AI_INSTRUCTIONS_VERSION } from "./setupAgent";

const SITE_ORIGIN = "https://price-fixture.test";
const HOME_URL = `${SITE_ORIGIN}/`;
const LIST_URL = `${SITE_ORIGIN}/shop`;
const SECOND_LIST_URL = `${SITE_ORIGIN}/shop?page=2`;
const FIRST_PRODUCT_URL = `${SITE_ORIGIN}/products/coastal-12`;
const SECOND_PRODUCT_URL = `${SITE_ORIGIN}/products/orchard-blend`;
const THIRD_PRODUCT_URL = `${SITE_ORIGIN}/products/highland-cask`;
const BRUICHLADDICH_ORIGIN = "https://bruichladdich-fixture.test";
const BRUICHLADDICH_HOME_URL = `${BRUICHLADDICH_ORIGIN}/`;
const BRUICHLADDICH_LIST_URL = `${BRUICHLADDICH_ORIGIN}/collections/all-whisky`;
const BRUICHLADDICH_PRODUCT_SLUGS = [
  "classic-laddie",
  "islay-barley",
  "port-charlotte-10",
  "octomore-15-1",
  "bere-barley",
] as const;
const BRUICHLADDICH_PRODUCT_URLS = BRUICHLADDICH_PRODUCT_SLUGS.map(
  (slug) => `${BRUICHLADDICH_ORIGIN}/products/${slug}`,
);
const BRUICHLADDICH_MERCH_URL = `${BRUICHLADDICH_ORIGIN}/products/laddie-t-shirt`;

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
            <nav aria-label="Shop pages">
              <a class="pagination-next" href="/shop?page=2">Next</a>
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
            <h1>More whisky</h1>
            <article class="product-card">
              <h2>Highland Cask</h2>
              <a class="product-card__link" href="/products/highland-cask">View product</a>
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
  [
    THIRD_PRODUCT_URL,
    `<!doctype html>
      <html lang="en">
        <body>
          <main class="product-page">
            <h1 class="product-title">Highland Cask</h1>
            <p class="product-price">$72.00</p>
            <p class="product-volume">700 ml</p>
            <span class="product-sku">HIGHLAND-700</span>
            <img class="product-image" src="https://price-fixture.test/images/highland-cask.jpg" alt="Highland Cask bottle">
          </main>
        </body>
      </html>`,
  ],
]);

// Regression fixture for Bruichladdich's mixed whisky and merchandise grid,
// observed on its public shop on 2026-09-09.
const BRUICHLADDICH_PAGES = new Map<string, string>([
  [
    BRUICHLADDICH_HOME_URL,
    '<main><h1>Bruichladdich</h1><a href="/collections/all-whisky">Shop whisky</a></main>',
  ],
  [
    BRUICHLADDICH_LIST_URL,
    `<main><h1>All products</h1>
      ${[
        ["Bruichladdich", "classic-laddie", "The Classic Laddie", "grey"],
        ["Bruichladdich", "islay-barley", "Islay Barley", "grey"],
        ["Port Charlotte", "port-charlotte-10", "Port Charlotte 10", "grey"],
        ["Octomore", "octomore-15-1", "Octomore 15.1", "grey"],
        ["Projects", "bere-barley", "Bere Barley", "grey"],
        ["Clothing", "laddie-t-shirt", "Laddie T-Shirt", "outline"],
      ]
        .map(
          ([category, slug, name, button]) => `
            <article class="collection-products-tile">
              <p class="collection-products-tile__collection-title">${category}</p>
              <div class="collection-products-tile__image-wrap">
                <a href="/products/${slug}"><img alt="${name}"></a>
              </div>
              <h2>${name}</h2>
              <div class="collection-products-tile__actions">
                <a class="button button--${button}" href="/products/${slug}">Discover</a>
              </div>
            </article>`,
        )
        .join("")}
    </main>`,
  ],
  ...BRUICHLADDICH_PRODUCT_SLUGS.map(
    (slug, index) =>
      [
        `${BRUICHLADDICH_ORIGIN}/products/${slug}`,
        `<main class="product-page">
          <h1 class="product-title">${["The Classic Laddie", "Islay Barley", "Port Charlotte 10", "Octomore 15.1", "Bere Barley"][index]}</h1>
          <p class="product-price">£${55 + index * 10}.00</p>
          <p class="product-volume">700 ml</p>
        </main>`,
      ] as const,
  ),
  [
    BRUICHLADDICH_MERCH_URL,
    '<main class="product-page"><h1 class="product-title">Laddie T-Shirt</h1><p class="product-price">£25.00</p><label>Size</label></main>',
  ],
]);

const BRUICHLADDICH_V6_RULES = {
  kind: "price",
  products: {
    oneProductPer: ".collection-products-tile",
    link: ".collection-products-tile__image-wrap a[href]",
    skipWhen: {
      selector: ".collection-products-tile__collection-title",
      startsWith: ["Accessories", "Clothing", "Glassware"],
    },
    nextPage: null,
    limit: 100,
  },
  product: {
    name: {
      try: [
        {
          get: "text",
          selector: ".product-title",
          take: "first",
          startsWith: null,
          clean: null,
        },
      ],
    },
    price: {
      try: [
        {
          get: "text",
          selector: ".product-price",
          take: "first",
          startsWith: null,
          clean: null,
        },
      ],
    },
    currency: "gbp",
    volume: {
      try: [
        {
          get: "text",
          selector: ".product-volume",
          take: "first",
          startsWith: null,
          clean: null,
        },
      ],
    },
    url: null,
    externalProductId: null,
    imageUrl: null,
    barcode: null,
  },
} as const satisfies StoredScrapeRules;

function getFixtureHtml(url: string) {
  const html = WEBSITE_PAGES.get(url);
  if (html === undefined) {
    throw new Error(`Missing fixture page: ${url}`);
  }
  return html;
}

function createFixtureWebsite(pages = WEBSITE_PAGES) {
  const requests: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requests.push(url.toString());
    const html = pages.get(url.toString());
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

async function completeSavedRun({
  runId,
  fetchImpl,
  registry,
}: {
  runId: number;
  fetchImpl: typeof fetch;
  registry: ReturnType<typeof createScraperRegistry>;
}) {
  while (true) {
    const result = await executeScraperRun({ runId }, { fetchImpl, registry });
    if (result.status === "completed") return result;
    if (result.status !== "waiting") {
      throw new Error("The saved scraper is already running.");
    }
    await wait(Math.max(0, result.nextAttemptAt.getTime() - Date.now()));
  }
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
        createdById: admin.id,
        kind: "price",
        websiteUrl: HOME_URL,
        name: "Price Fixture",
        sampleUrls: [],
      });
      // The test controls this local site. One request per second keeps the
      // check quick while still testing the wait between requests.
      await db
        .update(scrapeTargets)
        .set({ minimumSpacingMs: 1_000, requestsPerWindow: 3_600 })
        .where(eq(scrapeTargets.key, site.type));
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
        aiInstructionsVersion: AI_INSTRUCTIONS_VERSION,
        author: "ai",
        listUrl: LIST_URL,
        previewStatus: "pending",
      });
      if (!suggestedRevision) throw new Error("AI did not create a revision.");
      expect(suggestedRevision.aiModel).toBeTruthy();
      expect(suggestedRevision.rules).toMatchObject({
        kind: "price",
        list: { nextPage: expect.any(String) },
        detail: {
          id: expect.any(String),
          image: expect.any(String),
        },
      });

      const rules = loadExecutableScrapeRules(
        suggestedRevision.rulesVersion,
        suggestedRevision.rules,
      );
      const listResult = rules.parseList(
        getFixtureHtml(LIST_URL),
        new URL(LIST_URL),
      );
      expect(listResult).toEqual({
        issues: [],
        links: [FIRST_PRODUCT_URL, SECOND_PRODUCT_URL],
        nextPageUrl: SECOND_LIST_URL,
      });
      const parsedPages = [
        FIRST_PRODUCT_URL,
        SECOND_PRODUCT_URL,
        THIRD_PRODUCT_URL,
      ].map((url) => {
        const result = rules.parseDetail(getFixtureHtml(url), new URL(url));
        expect(result.issues).toEqual([]);
        if (result.kind !== "price") {
          throw new Error("Generated rules did not parse a price page.");
        }
        return result.value;
      });
      expect(parsedPages).toEqual([
        [
          {
            barcode: undefined,
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
            barcode: undefined,
            currency: "usd",
            externalProductId: "ORCHARD-70",
            imageUrl: "https://price-fixture.test/images/orchard-blend.jpg",
            name: "Orchard Blend",
            price: 12950,
            url: SECOND_PRODUCT_URL,
            volume: 700,
          },
        ],
        [
          {
            barcode: undefined,
            currency: "usd",
            externalProductId: "HIGHLAND-700",
            imageUrl: "https://price-fixture.test/images/highland-cask.jpg",
            name: "Highland Cask",
            price: 7200,
            url: THIRD_PRODUCT_URL,
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
        completeSavedRun({
          runId: previewRun.run.id,
          fetchImpl: fixtureWebsite.fetchImpl,
          registry,
        }),
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
        FIRST_PRODUCT_URL,
        SECOND_PRODUCT_URL,
        SECOND_LIST_URL,
        THIRD_PRODUCT_URL,
        LIST_URL,
        SECOND_LIST_URL,
        FIRST_PRODUCT_URL,
        SECOND_PRODUCT_URL,
        THIRD_PRODUCT_URL,
      ]);
    });

    test("preserves Bruichladdich whisky scope when migrating v6 rules", async () => {
      const [admin] = await db
        .insert(users)
        .values({
          admin: true,
          email: "bruichladdich-scraper-eval@example.com",
          username: "bruichladdich-scraper-eval",
        })
        .returning();
      if (!admin) throw new Error("Failed to create eval admin.");

      const { site, source } = await createSiteWithScrapeSource({
        createdById: admin.id,
        kind: "price",
        websiteUrl: BRUICHLADDICH_HOME_URL,
        name: "Bruichladdich Fixture",
        sampleUrls: [],
      });
      await db
        .update(scrapeTargets)
        .set({ minimumSpacingMs: 1_000, requestsPerWindow: 3_600 })
        .where(eq(scrapeTargets.key, site.type));
      await db
        .update(scrapeOrigins)
        .set({
          robotsMode: "not_applicable",
          robotsRationale: "Reserved test origin has no network operator.",
        })
        .where(eq(scrapeOrigins.origin, BRUICHLADDICH_ORIGIN));
      await db.insert(scrapeSourceRevisions).values({
        scrapeSourceId: source.id,
        revision: 1,
        rulesVersion: 6,
        listUrl: BRUICHLADDICH_LIST_URL,
        rules: BRUICHLADDICH_V6_RULES,
        author: "person",
        active: true,
        previewStatus: "passed",
        previewResult: {
          issues: [],
          pages: BRUICHLADDICH_PRODUCT_URLS.map((url) => ({
            kind: "price" as const,
            url,
            products: [],
          })),
        },
        createdById: admin.id,
      });

      const fixtureWebsite = createFixtureWebsite(BRUICHLADDICH_PAGES);
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
        .where(
          and(
            eq(scrapeSourceRevisions.scrapeSourceId, source.id),
            eq(scrapeSourceRevisions.author, "ai"),
          ),
        );
      if (!suggestedRevision) throw new Error("AI did not create a revision.");
      expect(suggestedRevision).toMatchObject({
        aiInstructionsVersion: AI_INSTRUCTIONS_VERSION,
        listUrl: BRUICHLADDICH_LIST_URL,
        rulesVersion: 11,
      });

      const rules = loadExecutableScrapeRules(
        suggestedRevision.rulesVersion,
        suggestedRevision.rules,
      );
      expect(
        rules.parseList(
          BRUICHLADDICH_PAGES.get(BRUICHLADDICH_LIST_URL)!,
          new URL(BRUICHLADDICH_LIST_URL),
        ),
      ).toEqual({
        issues: [],
        links: BRUICHLADDICH_PRODUCT_URLS,
        nextPageUrl: null,
      });

      const requestsBeforePreview = fixtureWebsite.requests.length;
      const previewRun = await createPinnedScrapeSourceRun(db, {
        externalSiteId: site.id,
        purpose: "preview",
        requestedById: admin.id,
        revisionId: suggestedRevision.id,
        scrapeSourceId: source.id,
        trigger: "manual",
      });
      await expect(
        completeSavedRun({
          runId: previewRun.run.id,
          fetchImpl: fixtureWebsite.fetchImpl,
          registry,
        }),
      ).resolves.toEqual({ status: "completed" });

      const [previewedRevision] = await db
        .select()
        .from(scrapeSourceRevisions)
        .where(eq(scrapeSourceRevisions.id, suggestedRevision.id));
      const preview = ScrapeSourcePreviewResultSchema.parse(
        previewedRevision?.previewResult,
      );
      expect(preview.issues).toEqual([]);
      expect(preview.pages.map((page) => page.url)).toEqual(
        BRUICHLADDICH_PRODUCT_URLS,
      );
      expect(
        fixtureWebsite.requests.slice(requestsBeforePreview),
      ).not.toContain(BRUICHLADDICH_MERCH_URL);
    });
  },
);
