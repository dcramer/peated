import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperSession } from "../types";
import {
  discoverFredMinnickArticles,
  discoverFredMinnickPostSitemaps,
  fredMinnickAdapter,
  parseFredMinnickArticle,
  type FredMinnickCursor,
  type FredMinnickObservation,
} from "./fredMinnick";

const STAGG_URL =
  "https://www.fredminnick.com/2026/01/06/review-2025-btac-george-t-stagg/";
const WELLER_URL =
  "https://www.fredminnick.com/2026/01/08/bourbon-review-2025-btac-william-larue-weller/";
const HANDY_URL =
  "https://www.fredminnick.com/2026/01/13/whiskey-review-2025-btac-thomas-h-handy-sazerac-rye/";

test("selects only the newest two same-origin post sitemaps", async () => {
  const index = await loadFixture("fredminnick", "sitemap-index.xml");

  expect(discoverFredMinnickPostSitemaps(index).map((url) => url.href)).toEqual(
    [
      "https://www.fredminnick.com/post-sitemap2.xml",
      "https://www.fredminnick.com/post-sitemap3.xml",
    ],
  );
});

test("discovers only supported current review URLs", async () => {
  const older = await loadFixture("fredminnick", "post-sitemap2.xml");
  const newer = await loadFixture("fredminnick", "post-sitemap3.xml");

  expect(
    discoverFredMinnickArticles([older, newer]).map((url) => url.href),
  ).toEqual([
    HANDY_URL,
    WELLER_URL,
    STAGG_URL,
    "https://www.fredminnick.com/2025/12/29/review-btac-e-h-taylor-bottled-in-bond-15-year/",
    "https://www.fredminnick.com/2025/12/03/review-barrell-20-year-toasted-bourbon-single-barrel/",
  ]);
});

test("extracts an unscored review and only direct tasting text", async () => {
  const html = await loadFixture("fredminnick", "review.html");
  const parsed = parseFredMinnickArticle(html, new URL(STAGG_URL));
  const reparsed = parseFredMinnickArticle(
    html.replace("2025 BTAC George T. Stagg", "2025   BTAC George T. Stagg"),
    new URL(STAGG_URL),
  );
  if (!parsed || !reparsed) throw new Error("Expected one parsed review.");

  expect(parsed.article).toMatchObject({
    canonicalUrl: STAGG_URL,
    title: "Review: 2025 BTAC George T. Stagg",
    publishedAt: new Date("2026-01-06T00:00:00.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    externalReviews: [
      {
        name: "2025 BTAC George T. Stagg",
        reviewerName: "Fred Minnick",
        nativeScore: null,
      },
    ],
  });
  expect(parsed.article.externalReviews[0]?.sourceKey).toBe(
    reparsed.article.externalReviews[0]?.sourceKey,
  );
  expect(Object.values(parsed.externalReviewTexts)).toEqual([
    "The nose has caramel and peach. The first sip adds brown sugar. On the palate, spice develops before a long fruit finish.",
  ]);
  expect(Object.values(parsed.externalReviewTexts).join(" ")).not.toMatch(
    /introduction|conclusion|navigation|price|read more/iu,
  );
});

test("skips a selected comparison article", async () => {
  const html = (await loadFixture("fredminnick", "review.html")).replace(
    "Review: 2025 BTAC George T. Stagg",
    "Whiskey Review: Thomas H. Handy, Sazerac 18 Year",
  );

  expect(parseFredMinnickArticle(html, new URL(HANDY_URL))).toBeNull();
});

test("fails a selected review with an unsupported title", async () => {
  const html = (await loadFixture("fredminnick", "review.html")).replace(
    "Review: 2025 BTAC George T. Stagg",
    "2025 BTAC George T. Stagg",
  );

  expect(() => parseFredMinnickArticle(html, new URL(STAGG_URL))).toThrow(
    "Bottle name is missing or ambiguous",
  );
});

test("resumes without requesting a completed current article", async () => {
  const index = await loadFixture("fredminnick", "sitemap-index.xml");
  const older = await loadFixture("fredminnick", "post-sitemap2.xml");
  const newer = await loadFixture("fredminnick", "post-sitemap3.xml");
  const article = await loadFixture("fredminnick", "review.html");
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body:
      url.pathname === "/sitemap_index.xml"
        ? index
        : url.pathname === "/post-sitemap2.xml"
          ? older
          : url.pathname === "/post-sitemap3.xml"
            ? newer.replaceAll(HANDY_URL, STAGG_URL)
            : article,
  }));
  const session: ScraperSession<FredMinnickCursor, FredMinnickObservation> = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 9,
  };

  await fredMinnickAdapter({
    cursor: {
      processedArticleUrls: [
        WELLER_URL,
        STAGG_URL,
        "https://www.fredminnick.com/2025/12/29/review-btac-e-h-taylor-bottled-in-bond-15-year/",
        "https://www.fredminnick.com/2025/12/03/review-barrell-20-year-toasted-bourbon-single-barrel/",
        "https://www.fredminnick.com/2025/09/24/review-2025-parkers-heritage-11-year-american-whiskey/",
      ],
    },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://www.fredminnick.com/sitemap_index.xml",
    "https://www.fredminnick.com/post-sitemap2.xml",
    "https://www.fredminnick.com/post-sitemap3.xml",
  ]);
  expect(emit).not.toHaveBeenCalled();
  expect(checkpoint).not.toHaveBeenCalled();
});
