import { loadFixture } from "@peated/server/lib/test/fixtures";
import { vi } from "vitest";
import type { ScraperSession } from "../types";
import {
  bourbonCultureAdapter,
  discoverBourbonCultureArticles,
  parseBourbonCultureArticle,
  type BourbonCultureCursor,
  type BourbonCultureObservation,
} from "./bourbonCulture";

const BOURBON_URL =
  "https://thebourbonculture.com/whiskey-reviews/example-bourbon-review/";
const RYE_URL =
  "https://thebourbonculture.com/whiskey-reviews/example-rye-review/";

test("discovers only six links from Latest Whiskey Reviews", async () => {
  const homepage = await loadFixture("bourbonculture", "index.html");
  const expandedHomepage = homepage.replace(
    "</ul>\n      <h2>Popular Reviews</h2>",
    `${Array.from(
      { length: 6 },
      (_, index) =>
        `<li><a class="wp-block-latest-posts__post-title" href="/whiskey-reviews/generated-${index}-review/">Generated ${index}</a></li>`,
    ).join("")}</ul>\n      <h2>Popular Reviews</h2>`,
  );

  expect(
    discoverBourbonCultureArticles(homepage).map((url) => url.href),
  ).toEqual([BOURBON_URL, RYE_URL]);
  expect(discoverBourbonCultureArticles(expandedHomepage)).toHaveLength(6);
  expect(
    discoverBourbonCultureArticles(expandedHomepage).at(-1)?.pathname,
  ).toBe("/whiskey-reviews/generated-3-review/");
});

test("extracts publisher facts and only tasting notes", async () => {
  const html = await loadFixture("bourbonculture", "review.html");
  const parsed = parseBourbonCultureArticle(html, new URL(BOURBON_URL));
  const reparsed = parseBourbonCultureArticle(
    html.replace(
      "Example 10 Year Old Bourbon",
      "Example   10 Year Old Bourbon",
    ),
    new URL(BOURBON_URL),
  );

  expect(parsed.article).toMatchObject({
    canonicalUrl: BOURBON_URL,
    title: "Example 10 Year Old Bourbon Review",
    publishedAt: new Date("2026-07-25T21:19:59.000Z"),
    contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    reviews: [
      {
        name: "Example 10 Year Old Bourbon",
        reviewerName: "Mike & Mike",
        nativeScore: { value: 9.5, scale: 10, display: "9.5/10" },
        normalizedRating: 95,
      },
    ],
  });
  expect(parsed.article.reviews[0]?.sourceKey).toBe(
    reparsed.article.reviews[0]?.sourceKey,
  );
  expect(Object.values(parsed.reviewTexts)).toEqual([
    "Nose: Cherry, vanilla, and mature oak. Palate: Caramel and baking spice. Finish: Long, dry, and balanced.",
  ]);
  expect(Object.values(parsed.reviewTexts).join(" ")).not.toMatch(
    /introduction|conclusion/iu,
  );
});

test("resumes without requesting a completed current article", async () => {
  const homepage = await loadFixture("bourbonculture", "index.html");
  const article = (
    await loadFixture("bourbonculture", "review.html")
  ).replaceAll("example-bourbon-review", "example-rye-review");
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi.fn(async ({ url }: { url: URL }) => ({
    url,
    status: 200,
    headers: {},
    body: url.pathname === "/" ? homepage : article,
  }));
  const session: ScraperSession<
    BourbonCultureCursor,
    BourbonCultureObservation
  > = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 7,
  };

  await bourbonCultureAdapter({
    cursor: { processedArticleUrls: [BOURBON_URL] },
    session,
  });

  expect(request.mock.calls.map(([input]) => input.url.href)).toEqual([
    "https://thebourbonculture.com/",
    RYE_URL,
  ]);
  expect(emit).toHaveBeenCalledWith(
    expect.objectContaining({ sourceKey: RYE_URL, itemCount: 1 }),
  );
  expect(checkpoint).toHaveBeenCalledWith({
    processedArticleUrls: [BOURBON_URL, RYE_URL],
  });
});
