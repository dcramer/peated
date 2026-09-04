import { loadFixture } from "@peated/server/lib/test/fixtures";
import { describe, expect, it } from "vitest";
import {
  discoverBourbonCultureArticles,
  parseBourbonCultureArticle,
} from "../adapters/bourbonCulture";
import { parseCompassBoxProducts } from "../adapters/legacy/scrapeCompassBox";
import { parseKilchomanProducts } from "../adapters/legacy/scrapeKilchoman";
import {
  discoverWhiskeyReviewerArticles,
  parseWhiskeyReviewerArticle,
} from "../adapters/whiskeyReviewer";
import { parseWhiskySagaArticle } from "../adapters/whiskySaga";
import { parseWhiskyStudyArticle } from "../adapters/whiskyStudy";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import { parseScrapeRules, type ScrapeRules } from "./rules";

const reviewConfig = {
  kind: "review" as const,
  list: {
    detailLink: { selector: "a.review", attribute: "href" },
    maxItems: 2,
  },
  detail: {
    title: { selector: "h1" },
    publishedAt: { selector: "time", attribute: "datetime" },
    reviewItem: "article.review",
    name: { selector: "h2" },
    reviewerName: { selector: ".author" },
    reviewText: { selector: ".body" },
    score: { value: { selector: ".score" }, scale: 100 },
  },
};

const whiskyStudyRules = {
  kind: "review",
  list: {
    detailLink: {
      selector: "article.blog-item h1.blog-title a[href]",
      attribute: "href",
    },
    maxItems: 20,
  },
  detail: {
    title: { selector: "h1.entry-title" },
    publishedAt: {
      selector: 'meta[itemprop="datePublished"]',
      attribute: "content",
    },
    reviewItem: "article.h-entry .blog-item-content.e-content",
    name: {
      selector: "h1.entry-title",
      removeSuffixes: ["Shelf Review", "Review"],
    },
    reviewerName: {
      selector: 'meta[itemprop="author"]',
      attribute: "content",
    },
    reviewText: {
      selector: "article.h-entry .blog-item-content.e-content p",
      startsWith: ["Nose:", "Palate:", "Taste:", "Finish:"],
      all: true,
    },
    score: {
      value: {
        selector:
          "article.h-entry .blog-item-content.e-content h1, article.h-entry .blog-item-content.e-content h2, article.h-entry .blog-item-content.e-content h3, article.h-entry .blog-item-content.e-content h4, article.h-entry .blog-item-content.e-content p",
        startsWith: ["Score"],
        removePrefixes: ["Score:"],
        suffix: "/100",
      },
      scale: 100,
    },
  },
} satisfies ScrapeRules;

const whiskySagaRules = {
  kind: "review",
  list: {
    detailLink: {
      selector: "article.blog-item a.blog-more-link[href]",
      attribute: "href",
    },
    maxItems: 20,
  },
  detail: {
    title: { selector: "h1.entry-title" },
    publishedAt: {
      selector: 'meta[itemprop="datePublished"]',
      attribute: "content",
    },
    reviewItem: "article.h-entry .blog-item-content",
    name: { selector: "h1.entry-title" },
    reviewerName: {
      selector: 'meta[itemprop="author"]',
      attribute: "content",
    },
    reviewText: {
      selector: "article.h-entry .blog-item-content p",
      startsWith: ["Nose:", "Palate:", "Taste:", "Finish:"],
      all: true,
    },
    score: {
      value: {
        selector: "article.h-entry .blog-item-content p",
        startsWith: ["Score"],
        removePrefixes: ["Score:", "Score"],
      },
      scale: 100,
    },
  },
} satisfies ScrapeRules;

const bourbonCultureRules = {
  kind: "review",
  list: {
    detailLink: {
      selector:
        "h2.wp-block-heading.has-white-background-color + ul.wp-block-latest-posts a.wp-block-latest-posts__post-title[href]",
      attribute: "href",
    },
    maxItems: 6,
  },
  detail: {
    title: { selector: "article h1.entry-title" },
    publishedAt: {
      selector: "article time.entry-date",
      attribute: "datetime",
    },
    reviewItem: "article .entry-content",
    name: {
      selector: "article h1.entry-title",
      removeSuffixes: ["Review"],
    },
    reviewerName: {
      selector: 'meta[name="author"]',
      attribute: "content",
    },
    reviewText: {
      selector: "article .entry-content p",
      startsWith: ["Nose:", "Palate:", "Finish:"],
      all: true,
    },
    score: {
      value: {
        selector:
          "article .entry-content h1, article .entry-content h2, article .entry-content h3, article .entry-content h4, article .entry-content p",
        startsWith: ["Score:"],
        removePrefixes: ["Score:"],
      },
      scale: 10,
    },
  },
} satisfies ScrapeRules;

const compassBoxRules = {
  kind: "price",
  list: {
    item: ".card-wrapper.product-card-wrapper",
    detailLink: { selector: ".card__heading a[href]", attribute: "href" },
    excludeWhen: { selector: ".badge", startsWith: ["Sold out"] },
    maxItems: 99,
  },
  detail: {
    name: { selector: "h1", prefix: "Compass Box " },
    price: { selector: ".price" },
    currency: "gbp",
    volume: { value: "700 ml" },
  },
} satisfies ScrapeRules;

const kilchomanRules = {
  kind: "price",
  list: {
    item: "ul.grid-products > li.product",
    detailLink: { selector: 'a[href*="/our-whisky/"]', attribute: "href" },
    excludeWhen: {
      selector: '.product_soldout, h3:contains("Gift Pack")',
    },
    maxItems: 99,
  },
  detail: {
    name: { selector: "h1", prefix: "Kilchoman " },
    price: { selector: ".price" },
    currency: "gbp",
    volume: { value: "700 ml" },
    imageUrl: {
      selector: 'meta[property="og:image"]',
      attribute: "content",
    },
  },
} satisfies ScrapeRules;

const whiskeyReviewerRules = {
  kind: "review",
  list: {
    detailLink: {
      selector:
        '.widget.posts-list:contains("Recent Reviews") a.post-title[href^="/"]:not([href*="?"]), .widget.posts-list:contains("Recent Reviews") a.post-title[href^="https://whiskeyreviewer.com/"]:not([href*="?"])',
      attribute: "href",
    },
    maxItems: 5,
  },
  detail: {
    canonicalUrl: {
      selector: 'link[rel="canonical"]',
      attribute: "href",
      removeSuffixes: ["/"],
    },
    title: { selector: "#the-post h1.entry-title" },
    publishedAt: { urlDateFormat: "/yyyy/MM/*-MMddyy" },
    reviewItem: "#the-post .entry-content",
    name: {
      selector: "#the-post h1.entry-title",
      removeSuffixes: ["Review", "Rview"],
    },
    reviewerName: {
      selector: "p",
      startsWith: ["By "],
      removePrefixes: ["By "],
    },
    reviewText: {
      selector:
        'p:contains("nose"), p:contains("Nose"), p:contains("palate"), p:contains("Palate"), p:contains("finish"), p:contains("Finish")',
      all: true,
    },
    score: {
      value: {
        selector: "#the-post .entry-content > p",
        startsWith: ["Rating:"],
        removePrefixes: ["Rating:"],
      },
      scale: 100,
      map: [
        { text: "A+", value: 100 },
        { text: "A", value: 95 },
        { text: "A-", value: 90 },
        { text: "B+", value: 87 },
        { text: "B", value: 83 },
        { text: "B-", value: 80 },
        { text: "C+", value: 77 },
        { text: "C", value: 73 },
        { text: "C-", value: 70 },
        { text: "D+", value: 67 },
        { text: "D", value: 63 },
        { text: "D-", value: 60 },
        { text: "F", value: 0 },
      ],
    },
  },
} satisfies ScrapeRules;

function expectReviewFactsAndEvidenceToMatch(
  configured: ReturnType<typeof parseScrapeDetail>,
  legacy: NonNullable<ReturnType<typeof parseWhiskyStudyArticle>>,
) {
  expect(configured.kind).toBe("review");
  expect(configured.issues).toEqual([]);
  if (configured.kind !== "review" || !configured.value) {
    throw new Error("Expected configured review output.");
  }
  const configuredReview = configured.value.article.externalReviews[0];
  const legacyReview = legacy.article.externalReviews[0];
  expect(configured.value.article).toMatchObject({
    canonicalUrl: legacy.article.canonicalUrl,
    title: legacy.article.title,
    publishedAt: legacy.article.publishedAt,
  });
  expect(configuredReview).toMatchObject({
    name: legacyReview?.name,
    reviewerName: legacyReview?.reviewerName,
    nativeScore: legacyReview?.nativeScore,
  });
  expect(Object.values(configured.value.externalReviewTexts)).toEqual(
    Object.values(legacy.externalReviewTexts),
  );
  expect(Object.values(configured.value.externalReviewBodies)).toEqual(
    Object.values(legacy.externalReviewBodies),
  );
}

describe("scrape source parser", () => {
  it("limits detail links to the same website", () => {
    const result = parseScrapeList(
      reviewConfig,
      '<a class="review" href="/one">One</a><a class="review" href="https://reviews.test/two#top">Two</a><a class="review" href="/three">Three</a>',
      new URL("https://reviews.test/archive"),
    );
    expect(result).toEqual({
      links: ["https://reviews.test/one", "https://reviews.test/two"],
      nextPageUrl: null,
      issues: [],
    });
  });

  it("extracts a same-website next page", () => {
    const result = parseScrapeList(
      {
        ...reviewConfig,
        list: {
          ...reviewConfig.list,
          nextPage: { selector: "a.next", attribute: "href" },
        },
      },
      '<a class="review" href="/one">One</a><a class="next" href="/archive?page=2">Next</a>',
      new URL("https://reviews.test/archive"),
    );
    expect(result).toEqual({
      links: ["https://reviews.test/one"],
      nextPageUrl: "https://reviews.test/archive?page=2",
      issues: [],
    });
  });

  it("excludes unavailable list cards with bounded text matching", () => {
    const result = parseScrapeList(
      {
        ...reviewConfig,
        list: {
          ...reviewConfig.list,
          item: ".product-card",
          excludeWhen: { selector: ".badge", startsWith: ["Sold out"] },
        },
      },
      '<article class="product-card"><span class="badge">New</span><a class="review" href="/one">One</a></article><article class="product-card"><span class="badge">SOLD OUT</span><a class="review" href="/two">Two</a></article><article class="product-card"><a class="review" href="/three">Three</a></article>',
      new URL("https://reviews.test/archive"),
    );

    expect(result).toEqual({
      links: ["https://reviews.test/one", "https://reviews.test/three"],
      nextPageUrl: null,
      issues: [],
    });
  });

  it("matches the current Compass Box parser's available product links", async () => {
    const pageUrl = new URL("https://www.compassboxwhisky.com/collections");
    const html = await loadFixture("compassbox", "bottle-list.html");
    const legacyLinks = parseCompassBoxProducts(html, pageUrl.toString()).map(
      ({ url }) => url,
    );

    expect(parseScrapeList(compassBoxRules, html, pageUrl)).toEqual({
      links: legacyLinks,
      nextPageUrl: null,
      issues: [],
    });
  });

  it("matches the current Kilchoman parser's available product links", async () => {
    const pageUrl = new URL("https://www.kilchomandistillery.com/whisky-shop/");
    const html = await loadFixture("kilchoman", "bottle-list.html");
    const legacyLinks = parseKilchomanProducts(html, pageUrl.toString()).map(
      ({ url }) => url,
    );

    expect(parseScrapeList(kilchomanRules, html, pageUrl)).toEqual({
      links: legacyLinks,
      nextPageUrl: null,
      issues: [],
    });
  });

  it("matches the current Bourbon Culture parser's latest review links", async () => {
    const pageUrl = new URL("https://thebourbonculture.com/");
    const html = await loadFixture("bourbonculture", "index.html");
    const legacyLinks = discoverBourbonCultureArticles(html).map(
      (url) => url.href,
    );

    expect(parseScrapeList(bourbonCultureRules, html, pageUrl)).toEqual({
      links: legacyLinks,
      nextPageUrl: null,
      issues: [],
    });
  });

  it("matches the current Whiskey Reviewer article links", async () => {
    const pageUrl = new URL("https://whiskeyreviewer.com/");
    const html = await loadFixture("whiskeyreviewer", "index.html");
    const legacyLinks = discoverWhiskeyReviewerArticles(html).map(
      (url) => url.href,
    );

    expect(parseScrapeList(whiskeyReviewerRules, html, pageUrl)).toEqual({
      links: [
        "https://whiskeyreviewer.com/2026/08/example-bourbon-review-081026/",
        "https://whiskeyreviewer.com/2026/08/example-scotch-review-080626/",
      ],
      nextPageUrl: null,
      issues: [],
    });
    expect(
      parseScrapeList(whiskeyReviewerRules, html, pageUrl).links.map((url) =>
        url.replace(/\/$/u, ""),
      ),
    ).toEqual(legacyLinks);
  });

  it("rejects a next page on another website", () => {
    const result = parseScrapeList(
      {
        ...reviewConfig,
        list: {
          ...reviewConfig.list,
          nextPage: { selector: "a.next", attribute: "href" },
        },
      },
      '<a class="review" href="/one">One</a><a class="next" href="https://other.test/page/2">Next</a>',
      new URL("https://reviews.test/archive"),
    );
    expect(result.nextPageUrl).toBeNull();
    expect(result.issues).toContainEqual({
      field: "list.nextPage",
      message: "Pages must stay on the source website.",
    });
  });

  it("rejects links on another origin", () => {
    const result = parseScrapeList(
      reviewConfig,
      '<a class="review" href="https://other.test/one">One</a>',
      new URL("https://reviews.test/archive"),
    );
    expect(result.links).toEqual([]);
    expect(result.issues.map((issue) => issue.message)).toContain(
      "Pages must stay on the source website.",
    );
  });

  it("extracts and validates review records", () => {
    const result = parseScrapeDetail(
      reviewConfig,
      '<h1>Spring reviews</h1><time datetime="2026-04-02"></time><article class="review"><h2>Example 12 Year</h2><span class="author">Ada</span><span class="score">91 / 100</span><div class="body">Rich and balanced.</div></article>',
      new URL("https://reviews.test/spring"),
    );
    expect(result.kind).toBe("review");
    expect(result.issues).toEqual([]);
    if (result.kind !== "review") throw new Error("Wrong kind");
    expect(result.value?.article.externalReviews[0]).toMatchObject({
      name: "Example 12 Year",
      reviewerName: "Ada",
      nativeScore: { value: 91, scale: 100, display: "91 / 100" },
    });
  });

  it("matches Whiskey Reviewer identity, URL date, grade, and evidence", async () => {
    const pageUrl = new URL(
      "https://whiskeyreviewer.com/2026/08/example-bourbon-review-081026/",
    );
    const html = await loadFixture("whiskeyreviewer", "review.html");
    const legacy = parseWhiskeyReviewerArticle(html, pageUrl);
    const configured = parseScrapeDetail(whiskeyReviewerRules, html, pageUrl);

    expect(configured.kind).toBe("review");
    expect(configured.issues).toEqual([]);
    if (configured.kind !== "review" || !configured.value) {
      throw new Error("Expected configured review output.");
    }
    expect(configured.value.article).toMatchObject({
      canonicalUrl: legacy.article.canonicalUrl,
      title: legacy.article.title,
      publishedAt: legacy.article.publishedAt,
    });
    expect(configured.value.article.externalReviews[0]).toMatchObject({
      name: legacy.article.externalReviews[0]?.name,
      reviewerName: legacy.article.externalReviews[0]?.reviewerName,
      nativeScore: legacy.article.externalReviews[0]?.nativeScore,
    });
    expect(Object.values(configured.value.externalReviewTexts)).toEqual(
      Object.values(legacy.externalReviewTexts),
    );
    expect(Object.values(configured.value.externalReviewBodies)).toEqual(
      Object.values(legacy.externalReviewBodies),
    );
  });

  it("rejects conflicting URL dates and unmapped scores", async () => {
    const html = (await loadFixture("whiskeyreviewer", "review.html"))
      .replace("/2026/08/example-bourbon", "/2025/08/example-bourbon")
      .replace("Rating: B+", "Rating: E");
    const result = parseScrapeDetail(
      whiskeyReviewerRules,
      html,
      new URL(
        "https://whiskeyreviewer.com/2025/08/example-bourbon-review-081026/",
      ),
    );

    expect(result).toMatchObject({ kind: "review", value: null });
    expect(result.issues).toEqual([
      { field: "detail.publishedAt", message: "Date is not valid." },
      {
        field: "detail.score",
        message: "Score is not in the configured map.",
      },
    ]);
  });

  it("removes Whisky Study title suffixes and finds a labeled score", () => {
    const result = parseScrapeDetail(
      {
        ...reviewConfig,
        detail: {
          ...reviewConfig.detail,
          name: {
            selector: "h2",
            removeSuffixes: ["Shelf Review", "Review"],
          },
          score: {
            value: {
              selector: "p, strong",
              startsWith: ["Score"],
              removePrefixes: ["Score:"],
              suffix: "/100",
            },
            scale: 100,
          },
        },
      },
      '<h1>Reviews</h1><time datetime="2026-04-02"></time><article class="review"><h2>Aberfeldy 18 Year Shelf Review</h2><p>Price: $120</p><strong>Score: 90</strong></article>',
      new URL("https://reviews.test/aberfeldy"),
    );

    expect(result).toMatchObject({
      kind: "review",
      issues: [],
      value: {
        article: {
          externalReviews: [
            {
              name: "Aberfeldy 18 Year",
              nativeScore: { value: 90, display: "90/100" },
            },
          ],
        },
      },
    });
  });

  it("joins only Whisky Saga tasting sections in document order", () => {
    const result = parseScrapeDetail(
      {
        ...reviewConfig,
        detail: {
          ...reviewConfig.detail,
          reviewText: {
            selector: ".body p",
            startsWith: ["Nose:", "Palate:", "Taste:", "Finish:"],
            all: true,
          },
          score: {
            value: {
              selector: ".body p",
              startsWith: ["Score"],
              removePrefixes: ["Score"],
            },
            scale: 100,
          },
        },
      },
      '<h1>Review</h1><time datetime="2026-04-02"></time><article class="review"><h2>Port Ellen</h2><div class="body"><p>An introduction.</p><p>Nose: smoke.</p><p>Price: high.</p><p>Palate: citrus.</p><p>Finish: long.</p><p>Score 90/100</p></div></article>',
      new URL("https://reviews.test/port-ellen"),
    );
    if (result.kind !== "review" || !result.value)
      throw new Error("Expected review output.");
    expect(Object.values(result.value.externalReviewTexts)).toEqual([
      "Nose: smoke. Palate: citrus. Finish: long.",
    ]);
    expect(result.value.article.externalReviews[0]?.nativeScore).toMatchObject({
      value: 90,
      display: "90/100",
    });
  });

  it("matches the current Whisky Study parser facts and evidence", async () => {
    const url = new URL(
      "https://thewhiskystudy.com/reviews-3/example-scotch-review",
    );
    const html = (await loadFixture("whiskystudy", "review.html")).replace(
      "<head>",
      '<head><meta itemprop="datePublished" content="2026-07-04T12:03:15-0700"><meta itemprop="author" content="Chris Ellis">',
    );
    const legacy = parseWhiskyStudyArticle(html, url);
    expect(legacy).not.toBeNull();
    if (!legacy) throw new Error("Expected legacy review output.");

    expectReviewFactsAndEvidenceToMatch(
      parseScrapeDetail(whiskyStudyRules, html, url),
      legacy,
    );
  });

  it("matches the current Whisky Saga parser facts and evidence", async () => {
    const url = new URL("https://www.whiskysaga.com/blog/example-scotch");
    const html = (await loadFixture("whiskysaga", "review.html")).replace(
      "<head>",
      '<head><meta itemprop="datePublished" content="2026-08-17T22:36:08+0200"><meta itemprop="author" content="Thomas Øhrbom">',
    );
    const legacy = parseWhiskySagaArticle(html, url);
    expect(legacy).not.toBeNull();
    if (!legacy) throw new Error("Expected legacy review output.");

    expectReviewFactsAndEvidenceToMatch(
      parseScrapeDetail(whiskySagaRules, html, url),
      legacy,
    );
  });

  it("matches the current Bourbon Culture parser facts and evidence", async () => {
    const url = new URL(
      "https://thebourbonculture.com/whiskey-reviews/example-bourbon-review/",
    );
    const html = await loadFixture("bourbonculture", "review.html");
    const legacy = parseBourbonCultureArticle(html, url);
    expect(legacy.article.externalReviews).toHaveLength(1);

    expectReviewFactsAndEvidenceToMatch(
      parseScrapeDetail(bourbonCultureRules, html, url),
      legacy,
    );
  });

  it("uses fixed values and literal prefixes before price validation", () => {
    const result = parseScrapeDetail(
      {
        kind: "price",
        list: {
          detailLink: { selector: "a.product", attribute: "href" },
          maxItems: 10,
        },
        detail: {
          name: { selector: "h1", prefix: "Kilchoman " },
          price: { selector: ".price" },
          currency: "gbp",
          volume: { value: "700 ml" },
        },
      },
      '<h1>Machir Bay</h1><span class="price">£49.95</span>',
      new URL("https://store.test/products/machir-bay"),
    );
    expect(result).toMatchObject({
      kind: "price",
      issues: [],
      value: [{ name: "Kilchoman Machir Bay", price: 4995, volume: 700 }],
    });
  });

  it("reports joined values over the element bound", () => {
    const result = parseScrapeDetail(
      {
        ...reviewConfig,
        detail: {
          ...reviewConfig.detail,
          reviewText: { selector: ".body p", all: true },
        },
      },
      `<h1>Review</h1><time datetime="2026-04-02"></time><article class="review"><h2>Bottle</h2><div class="body">${Array.from({ length: 101 }, () => "<p>Nose: smoke.</p>").join("")}</div></article>`,
      new URL("https://reviews.test/too-many"),
    );
    expect(result).toMatchObject({
      kind: "review",
      issues: [
        {
          field: "detail.reviewItem",
          message: "Value matched more than 100 elements.",
        },
      ],
    });
  });

  it("treats values emptied by literal cleanup as missing", () => {
    const result = parseScrapeDetail(
      {
        ...reviewConfig,
        detail: {
          ...reviewConfig.detail,
          name: { selector: "h2", removeSuffixes: ["Review"] },
        },
      },
      '<h1>Reviews</h1><time datetime="2026-04-02"></time><article class="review"><h2>Review</h2></article>',
      new URL("https://reviews.test/empty-name"),
    );
    expect(result.issues).toContainEqual({
      field: "detail.name",
      message: "Required value was not found.",
    });
  });

  it("keeps version 1 parsing output unchanged", () => {
    const rules = parseScrapeRules(1, reviewConfig);
    const result = parseScrapeDetail(
      rules,
      '<h1>Spring reviews</h1><time datetime="2026-04-02"></time><article class="review"><h2>Example 12 Year</h2><span class="score">91 / 100</span><div class="body">Rich and balanced.</div></article>',
      new URL("https://reviews.test/spring"),
    );
    expect(result).toMatchObject({
      kind: "review",
      issues: [],
      value: {
        article: {
          externalReviews: [
            { name: "Example 12 Year", nativeScore: { value: 91 } },
          ],
        },
      },
    });
  });

  it("reads page fields for a single review", () => {
    const result = parseScrapeDetail(
      reviewConfig,
      '<h1>Spring reviews</h1><time datetime="2026-04-02"></time><h2>Example 12 Year</h2><article class="review"><span class="author">Ada</span><div class="body">Rich and balanced.</div></article>',
      new URL("https://reviews.test/spring"),
    );

    expect(result).toMatchObject({
      kind: "review",
      issues: [],
      value: {
        article: {
          externalReviews: [{ name: "Example 12 Year", reviewerName: "Ada" }],
        },
      },
    });
  });

  it("keeps complete plain-text bodies per review while selecting narrower tasting text", () => {
    const longParagraph = "Body prose. ".repeat(5000).trim();
    const result = parseScrapeDetail(
      reviewConfig,
      `
      <nav>Page navigation</nav><h1>Two reviews</h1><time datetime="2026-09-01"></time>
      <article class="review"><h2>First Bottle</h2><p>An introduction &amp;
        background.</p>
        <p>${longParagraph}</p><div class="body">Nose: vanilla.</div><p>A final conclusion.</p>
        <script>privateScript()</script><style>privateStyle</style><form>Form data</form>
        <aside>Other reviews</aside><div id="comments">User comments</div>
      </article>
      <article class="review"><h2>Second Bottle</h2><p>Another introduction.</p><div class="body">Palate: smoke.</div></article>
    `,
      new URL("https://reviews.test/full-bodies"),
    );
    expect(result.issues).toEqual([]);
    if (result.kind !== "review" || !result.value)
      throw new Error("Expected reviews");
    const [first, second] = result.value.article.externalReviews;
    expect(result.value.externalReviewBodies).toEqual({
      [first.sourceKey]: `First Bottle\n\nAn introduction & background.\n\n${longParagraph}\n\nNose: vanilla.\n\nA final conclusion.`,
      [second.sourceKey]:
        "Second Bottle\n\nAnother introduction.\n\nPalate: smoke.",
    });
    expect(result.value.externalReviewTexts).toEqual({
      [first.sourceKey]: "Nose: vanilla.",
      [second.sourceKey]: "Palate: smoke.",
    });
  });

  it("does not reuse a page field for repeated reviews", () => {
    const result = parseScrapeDetail(
      reviewConfig,
      '<h1>Spring reviews</h1><h2>Shared bottle</h2><article class="review"></article><article class="review"></article>',
      new URL("https://reviews.test/spring"),
    );

    expect(result.kind).toBe("review");
    expect(result.value).toBeNull();
    expect(
      result.issues.filter(({ field }) => field === "detail.name"),
    ).toHaveLength(2);
  });

  it.each([
    [
      "a writer inside one review",
      "",
      '<span class="author">Ada</span>',
      ["Ada", null],
    ],
    [
      "ambiguous page bylines",
      '<span class="author">Ada</span><span class="author">Grace</span>',
      "",
      [null, null],
    ],
    [
      "a review writer overriding the page byline",
      '<span class="author">Ada</span>',
      '<span class="author">Grace</span>',
      ["Grace", "Ada"],
    ],
  ])(
    "keeps review fields separate with %s",
    (_, pageBylines, firstByline, reviewers) => {
      const result = parseScrapeDetail(
        reviewConfig,
        `<h1>Two reviews</h1><time datetime="2026-08-22"></time>${pageBylines}
      <span class="score">99</span>
      <article class="review"><h2>First Bottle</h2>${firstByline}<span class="score">88</span></article>
      <article class="review"><h2>Second Bottle</h2></article>`,
        new URL("https://reviews.test/two-bottles"),
      );
      expect(result).toMatchObject({
        kind: "review",
        issues: [],
        value: {
          article: {
            externalReviews: [
              {
                name: "First Bottle",
                reviewerName: reviewers[0],
                nativeScore: { value: 88 },
              },
              {
                name: "Second Bottle",
                reviewerName: reviewers[1],
                nativeScore: null,
              },
            ],
          },
        },
      });
    },
  );

  it("extracts repeated reviews and reports invalid dates and scores", () => {
    const result = parseScrapeDetail(
      reviewConfig,
      '<h1>Spring reviews</h1><time datetime="not-a-date"></time><article class="review"><h2>First Bottle</h2><span class="score">none</span></article><article class="review"><h2>Second Bottle</h2><span class="score">88</span></article>',
      new URL("https://reviews.test/spring"),
    );
    expect(result.kind).toBe("review");
    if (result.kind !== "review") throw new Error("Wrong kind");
    expect(result.value).toBeNull();
    expect(result.issues).toEqual([
      { field: "detail.publishedAt", message: "Date is not valid." },
      {
        field: "detail.score",
        message: "Score is not a number.",
      },
    ]);
  });

  it("reports required review fields when unrelated markup is selected", () => {
    const result = parseScrapeDetail(
      reviewConfig,
      "<main><p>Nothing to parse</p></main>",
      new URL("https://reviews.test/unrelated"),
    );
    expect(result.kind).toBe("review");
    if (result.kind !== "review") throw new Error("Wrong kind");
    expect(result.value).toBeNull();
    expect(result.issues.map(({ field }) => field)).toEqual([
      "detail.publishedAt",
      "detail.title",
      "detail.reviewItem",
    ]);
  });

  it("normalizes a store price and volume", () => {
    const result = parseScrapeDetail(
      {
        kind: "price",
        list: {
          detailLink: { selector: "a.product", attribute: "href" },
          maxItems: 10,
        },
        detail: {
          name: { selector: "h1" },
          price: { selector: ".price" },
          currency: "usd",
          volume: { selector: ".volume" },
        },
      },
      '<h1>Example Whisky</h1><span class="price">$84.99</span><span class="volume">70cl</span>',
      new URL("https://store.test/products/example"),
    );
    expect(result).toEqual({
      kind: "price",
      value: [
        {
          name: "Example Whisky",
          price: 8499,
          currency: "usd",
          volume: 700,
          url: "https://store.test/products/example",
          imageUrl: null,
        },
      ],
      issues: [],
    });
  });

  it("converts liters to milliliters", () => {
    const result = parseScrapeDetail(
      {
        kind: "price",
        list: {
          detailLink: { selector: "a.product", attribute: "href" },
          maxItems: 10,
        },
        detail: {
          name: { selector: "h1" },
          price: { selector: ".price" },
          currency: "usd",
          volume: { selector: ".volume" },
        },
      },
      '<h1>Example Whisky</h1><span class="price">$84.99</span><span class="volume">0.75l</span>',
      new URL("https://store.test/products/example"),
    );
    expect(result).toMatchObject({
      kind: "price",
      value: [{ volume: 750 }],
      issues: [],
    });
  });

  it("reports invalid store fields", () => {
    const result = parseScrapeDetail(
      {
        kind: "price",
        list: {
          detailLink: { selector: "a.product", attribute: "href" },
          maxItems: 10,
        },
        detail: {
          name: { selector: "h1" },
          price: { selector: ".price" },
          currency: "usd",
          volume: { selector: ".volume" },
        },
      },
      '<h1></h1><span class="price">unknown</span><span class="volume">large</span>',
      new URL("https://store.test/products/invalid"),
    );
    expect(result).toMatchObject({
      kind: "price",
      value: [],
    });
    expect(result.issues.map((issue) => issue.field)).toEqual([
      "detail.name",
      "detail.price",
      "detail.volume",
    ]);
  });

  it("reports a selector that no longer finds detail links", () => {
    const result = parseScrapeList(
      reviewConfig,
      '<a class="new-review-link" href="/one">One</a>',
      new URL("https://reviews.test/archive"),
    );
    expect(result).toEqual({
      links: [],
      nextPageUrl: null,
      issues: [
        {
          field: "list.detailLink",
          message: "The selector did not find any detail links.",
        },
      ],
    });
  });
});
