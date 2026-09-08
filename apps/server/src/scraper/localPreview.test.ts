import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalSiteRuns,
  externalSiteScrapeTargets,
  externalSites,
  storePrices,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { createSiteWithScrapeSource } from "./configured/service";
import type { ScraperHttpClock } from "./http";
import { runLocalScrapeSourcePreview } from "./localPreview";

function previewClock(): ScraperHttpClock {
  let now = new Date("2026-09-03T12:00:00Z");
  return {
    now: () => now,
    sleep: async (milliseconds) => {
      now = new Date(now.getTime() + milliseconds);
    },
    random: () => 0,
  };
}

test("previews an admin-managed source without product writes", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ admin: true });
  await createSiteWithScrapeSource({
    name: "Example Reviews",
    kind: "review",
    websiteUrl: "https://reviews.example/",
    createdById: user.id,
  });
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow:");
    }
    if (url.pathname === "/reviews-3") {
      return new Response('<a class="review" href="/reviews-3/one">One</a>');
    }
    if (url.pathname === "/reviews-3/one") {
      return new Response(`
        <article>
          <h1>Example Whisky</h1>
          <time datetime="2026-09-01"></time>
          <div class="review"><h2>Example Whisky Review</h2><p>Tasting notes.</p><strong>88</strong></div>
        </article>
      `);
    }
    return new Response(null, { status: 404 });
  });

  const result = await runLocalScrapeSourcePreview(
    {
      site: "reviews-example",
      listUrl: "https://reviews.example/reviews-3",
      rulesVersion: 6,
      rules: {
        kind: "review",
        articles: {
          oneArticlePer: "body",
          link: "a.review",
          skipWhen: null,
          nextPage: null,
          limit: 20,
        },
        article: {
          canonicalUrl: null,
          title: {
            try: [
              {
                get: "text",
                selector: "h1",
                take: "first",
                startsWith: null,
                clean: null,
              },
            ],
          },
          publishedDate: {
            try: [
              {
                get: "attribute",
                selector: "time",
                attribute: "datetime",
                clean: null,
              },
            ],
          },
          reviews: {
            inside: "article",
            oneReviewPer: "element",
            selector: ".review",
            name: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: "h2",
                  take: "first",
                  startsWith: null,
                  clean: {
                    removeStart: null,
                    removeEnd: ["Review"],
                    addStart: null,
                    addEnd: null,
                  },
                },
              ],
            },
            reviewer: null,
            tastingNotes: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: "p",
                  take: "first",
                  startsWith: null,
                  clean: null,
                },
              ],
            },
            score: {
              try: [
                {
                  get: "text",
                  from: "review",
                  selector: "strong",
                  take: "first",
                  startsWith: null,
                  clean: null,
                },
              ],
              scale: 100,
              map: null,
            },
          },
        },
      },
      limit: 1,
    },
    {
      fetchImpl,
      clock: previewClock(),
      executionToken: "local-preview-owner",
    },
  );

  expect(result.run).toMatchObject({
    status: "succeeded",
    requestCount: 3,
    emittedItemCount: 0,
    itemCount: 0,
  });
  expect(result.preview).toEqual({
    issues: [],
    pages: [
      {
        kind: "review",
        url: "https://reviews.example/reviews-3/one",
        title: "Example Whisky",
        publishedAt: "2026-09-01T00:00:00.000Z",
        reviews: [
          {
            name: "Example Whisky",
            reviewerName: null,
            nativeScore: { value: 88, scale: 100, display: "88" },
          },
        ],
      },
    ],
  });
  expect(await db.select().from(externalReviewArticles)).toHaveLength(0);
  expect(await db.select().from(storePrices)).toHaveLength(0);

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, result.run.id));
  expect(storedRun?.status).toBe("succeeded");
}, 15_000);

test("previews price rules without storing prices", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow:");
    }
    if (url.pathname === "/whisky") {
      return new Response('<a class="product" href="/example.html">One</a>');
    }
    if (url.pathname === "/example.html") {
      return new Response(`
        <h1>Example Whisky</h1>
        <span class="price">€42.50</span>
        <span class="volume">70 cl</span>
      `);
    }
    return new Response(null, { status: 404 });
  });

  const result = await runLocalScrapeSourcePreview(
    {
      site: "finedrams",
      listUrl: "https://www.finedrams.com/whisky",
      rules: {
        kind: "price",
        list: {
          detailLink: { selector: "a.product", attribute: "href" },
          maxItems: 20,
        },
        detail: {
          name: { selector: "h1" },
          price: { selector: ".price" },
          currency: "eur",
          volume: { selector: ".volume" },
        },
      },
      limit: 1,
    },
    {
      fetchImpl,
      clock: previewClock(),
      executionToken: "local-price-preview-owner",
    },
  );

  expect(result.run).toMatchObject({
    status: "succeeded",
    requestCount: 3,
    emittedItemCount: 0,
    itemCount: 0,
  });
  expect(result.preview).toEqual({
    issues: [],
    pages: [
      {
        kind: "price",
        url: "https://www.finedrams.com/example.html",
        products: [
          {
            externalProductId: null,
            name: "Example Whisky",
            price: 4250,
            currency: "eur",
            volume: 700,
            url: "https://www.finedrams.com/example.html",
            imageUrl: null,
            barcode: null,
          },
        ],
      },
    ],
  });
  expect(await db.select().from(externalReviewArticles)).toHaveLength(0);
  expect(await db.select().from(storePrices)).toHaveLength(0);
  const [site] = await db
    .select({ id: externalSites.id })
    .from(externalSites)
    .where(eq(externalSites.type, "finedrams"));
  expect(
    await db
      .select({ managedBy: externalSiteScrapeTargets.managedBy })
      .from(externalSiteScrapeTargets)
      .where(eq(externalSiteScrapeTargets.externalSiteId, site!.id)),
  ).toContainEqual({ managedBy: "admin" });
});

test("previews a site that exists only in production", async () => {
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow:");
    }
    if (url.pathname === "/whisky") {
      return new Response('<a class="product" href="/whisky/one">One</a>');
    }
    if (url.pathname === "/whisky/one") {
      return new Response("<main><h1>Example Whisky</h1></main>");
    }
    return new Response(null, { status: 404 });
  });

  const result = await runLocalScrapeSourcePreview(
    {
      site: "production-only-example",
      listUrl: "https://production-only.example/whisky",
      rulesVersion: 10,
      rules: {
        kind: "catalog",
        list: {
          links: "a.product",
          nextPage: null,
          limit: 20,
        },
        detail: {
          name: "h1",
          url: null,
          id: null,
          image: null,
          volume: null,
          abv: null,
          age: null,
          edition: null,
          year: null,
        },
      },
      limit: 1,
    },
    {
      fetchImpl,
      clock: previewClock(),
      executionToken: "production-only-preview-owner",
    },
  );

  expect(result.run).toMatchObject({
    status: "succeeded",
    requestCount: 3,
    emittedItemCount: 0,
  });
  expect(result.preview).toEqual({
    issues: [],
    pages: [
      {
        kind: "catalog",
        url: "https://production-only.example/whisky/one",
        products: [
          {
            externalProductId: null,
            name: "Example Whisky",
            url: "https://production-only.example/whisky/one",
            imageUrl: null,
            volume: null,
            sourceBottleIdentity: null,
          },
        ],
      },
    ],
  });
  expect(await db.select().from(storePrices)).toHaveLength(0);
});
