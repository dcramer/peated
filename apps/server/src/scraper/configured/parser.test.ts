import { loadFixture } from "@peated/server/lib/test/fixtures";
import { describe, expect, it } from "vitest";
import {
  discoverBourbonCultureArticles,
  parseBourbonCultureArticle,
} from "../adapters/bourbonCulture";
import { parseDramfaceArticle } from "../adapters/dramface";
import { parseCompassBoxProducts } from "../adapters/legacy/scrapeCompassBox";
import { parseKilchomanProducts } from "../adapters/legacy/scrapeKilchoman";
import {
  discoverWhiskeyReviewerArticles,
  parseWhiskeyReviewerArticle,
} from "../adapters/whiskeyReviewer";
import {
  discoverWhiskyNotesArticles,
  parseWhiskyNotesArticle,
} from "../adapters/whiskyNotes";
import { parseWhiskySagaArticle } from "../adapters/whiskySaga";
import { parseWhiskyStudyArticle } from "../adapters/whiskyStudy";
import {
  discoverWordsOfWhiskyArticles,
  parseWordsOfWhiskyArticle,
} from "../adapters/wordsOfWhisky";
import { parseScrapeDetail, parseScrapeList } from "./parser";
import {
  parseScrapeRules,
  type ScrapeRules,
  type ScrapeRulesV5,
  type ScrapeRulesV9,
} from "./rules";

it("reads price fields from text and their usual HTML attributes", () => {
  const rules = {
    kind: "price",
    list: {
      links: ".product a[href]",
      nextPage: null,
      limit: 10,
    },
    detail: {
      name: "h1",
      price: ".price",
      currency: "gbp",
      volume: 700,
      url: 'link[rel="canonical"]',
      id: "input[name='product-id']",
      image: 'meta[property="og:image"]',
      barcode: null,
    },
  } satisfies ScrapeRules;

  expect(
    parseScrapeList(
      rules,
      '<div class="product"><a href="/products/one">One</a></div>',
      new URL("https://shop.example/products"),
    ),
  ).toEqual({
    links: ["https://shop.example/products/one"],
    nextPageUrl: null,
    issues: [],
  });

  expect(
    parseScrapeDetail(
      rules,
      `<head>
        <link rel="canonical" href="/products/one">
        <meta property="og:image" content="https://images.example/one.jpg">
      </head><body>
        <h1>Example Whisky</h1>
        <span class="price"></span>
        <span class="price"><s>£1,399.95</s> £1,299.95</span>
        <input name="product-id" value="product-1">
      </body>`,
      new URL("https://shop.example/products/one?ref=list"),
    ),
  ).toMatchObject({
    kind: "price",
    issues: [],
    value: [
      {
        name: "Example Whisky",
        price: 129995,
        currency: "gbp",
        volume: 700,
        url: "https://shop.example/products/one",
        externalProductId: "product-1",
        imageUrl: "https://images.example/one.jpg",
      },
    ],
  });
});

it("splits unwrapped reviews at their name selectors", () => {
  const rules = {
    kind: "review",
    list: { links: "a.review", nextPage: null, limit: 10 },
    detail: {
      url: null,
      title: "h1",
      date: null,
      reviews: {
        area: "main",
        item: null,
        name: "h2.name",
        reviewer: ".writer",
        tastingNotes: ".notes",
        score: { selector: ".score", outOf: 100 },
      },
    },
  } satisfies ScrapeRules;
  const result = parseScrapeDetail(
    rules,
    `<h1>Two new whiskies</h1><main>
      <h2 class="name">First Whisky</h2><p class="writer">Ada</p>
      <p>First review body.</p><p class="notes">Apple and oak.</p><b class="score">Score: 88/100</b>
      <h2 class="name">Second Whisky</h2><p class="writer">Bea</p>
      <p>Second review body.</p><p class="notes">Pear and smoke.</p><b class="score">91 points</b>
    </main>`,
    new URL("https://reviews.example/2026/09/07/two-whiskies"),
  );

  expect(result).toMatchObject({
    kind: "review",
    issues: [],
    value: {
      article: {
        title: "Two new whiskies",
        publishedAt: new Date("2026-09-07T00:00:00.000Z"),
        externalReviews: [
          {
            name: "First Whisky",
            reviewerName: "Ada",
            nativeScore: { value: 88, scale: 100 },
          },
          {
            name: "Second Whisky",
            reviewerName: "Bea",
            nativeScore: { value: 91, scale: 100 },
          },
        ],
      },
    },
  });
});

it("uses an article writer for each wrapped review", () => {
  const rules = {
    kind: "review",
    list: { links: "a.review", nextPage: null, limit: 10 },
    detail: {
      url: null,
      title: "h1",
      date: null,
      reviews: {
        area: "article",
        item: "section.tasting",
        name: "h2",
        reviewer: ".byline",
        tastingNotes: null,
        score: { selector: ".score", outOf: 100 },
      },
    },
  } satisfies ScrapeRules;
  const result = parseScrapeDetail(
    rules,
    `<article><h1>Two island malts</h1><time datetime="2026-08-22"></time>
      <span class="byline">Mara Vale</span>
      <section class="tasting"><h2>First Malt</h2><b class="score">88/100</b></section>
      <section class="tasting"><h2>Second Malt</h2><b class="score">85/100</b></section>
    </article>`,
    new URL("https://reviews.example/two-malts"),
  );

  expect(result).toMatchObject({
    kind: "review",
    issues: [],
    value: {
      article: {
        externalReviews: [
          { name: "First Malt", reviewerName: "Mara Vale" },
          { name: "Second Malt", reviewerName: "Mara Vale" },
        ],
      },
    },
  });
});

it("removes a trailing review label from a single article title", () => {
  const rules = {
    kind: "review",
    list: { links: "a.review", nextPage: null, limit: 10 },
    detail: {
      url: null,
      title: "h1",
      date: null,
      reviews: {
        area: "article",
        item: null,
        name: null,
        reviewer: ".author",
        tastingNotes: null,
        score: { selector: ".score", outOf: 5 },
      },
    },
  } satisfies ScrapeRules;
  const result = parseScrapeDetail(
    rules,
    `<article><h1>Orchard Bourbon review</h1>
      <meta itemprop="datePublished" content="2026-08-21">
      <span class="author">Jon Bell</span><b class="score">3.5</b>
    </article>`,
    new URL("https://reviews.example/orchard-bourbon"),
  );

  expect(result).toMatchObject({
    kind: "review",
    issues: [],
    value: {
      article: {
        title: "Orchard Bourbon review",
        externalReviews: [
          { name: "Orchard Bourbon", reviewerName: "Jon Bell" },
        ],
      },
    },
  });
});

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
} satisfies ScrapeRulesV5;

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
} satisfies ScrapeRulesV5;

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
} satisfies ScrapeRulesV5;

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
} satisfies ScrapeRulesV5;

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
} satisfies ScrapeRulesV5;

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
} satisfies ScrapeRulesV5;

const wordsOfWhiskyRules = {
  kind: "review",
  list: {
    item: "article.category-tastingnotes",
    detailLink: { selector: "a[href]", attribute: "href" },
    maxItems: 20,
  },
  detail: {
    canonicalUrl: {
      selector: 'link[rel="canonical"]',
      attribute: "href",
      removeSuffixes: ["/"],
    },
    title: { selector: ".post-wrap .entry-title" },
    publishedAt: {
      selector: ".post-wrap time.entry-date",
      attribute: "datetime",
    },
    reviewItem: { start: ".entry-content > h2" },
    name: { selector: "h2" },
    reviewerName: {
      selector: ".side-author__wrap .side-meta .title",
    },
    reviewText: {
      selector: "p",
      startsWith: ["Nose:", "Palate:", "Taste:", "Finish:"],
      all: true,
    },
    score: {
      value: {
        selector: ".lets-review-block__final-score",
        suffix: "/10",
      },
      scale: 10,
    },
  },
} satisfies ScrapeRulesV5;

const whiskyNotesRules = {
  kind: "review",
  list: {
    item: "#featured article, #posts article",
    detailLink: { selector: "a.entry-permalink", attribute: "href" },
    excludeWhen: {
      selector:
        ".category-armagnac, .category-bars, .category-cognac, .category-distillery-visits, .category-other-spirits, .category-rum, .category-whisky-news",
    },
    nextPage: { selector: 'link[rel="next"]', attribute: "href" },
    maxItems: 20,
  },
  detail: {
    title: { selector: "#main article.post .entry-title" },
    publishedAt: {
      selector: "#main article.post time.entry-date.published",
      attribute: "datetime",
    },
    reviewItem: {
      start:
        '.entry-content > h2:contains("%"), .entry-content > h2:contains("Proof"), .entry-content > h2:contains("proof")',
      endBefore: ".entry-content > .yarpp",
    },
    name: { selector: "h2" },
    reviewerName: { selector: ".author.vcard" },
    reviewText: { selector: "h2, h2 ~ p", all: true },
    score: {
      value: {
        selector:
          'p:contains("Score:") > span:last-child strong, p:contains("Score:") > strong:last-child',
        removeSuffixes: ["/100"],
        suffix: "/100",
      },
      firstReviewFallback: {
        selector: ".entry-score",
        suffix: "/100",
      },
      scale: 100,
    },
  },
} satisfies ScrapeRulesV5;

function pageText(selector: string) {
  return {
    try: [
      {
        get: "text" as const,
        selector,
        take: "first" as const,
        match: null,
        addStart: null,
        addEnd: null,
      },
    ],
  };
}

function pageAttribute(selector: string, attribute: string) {
  return {
    try: [
      {
        get: "attribute" as const,
        selector,
        attribute,
        match: null,
        addStart: null,
        addEnd: null,
      },
    ],
  };
}

function reviewText(selector: string, take: "first" | "all" = "first") {
  return {
    try: [
      {
        get: "text" as const,
        from: "review" as const,
        selector,
        take,
        match: null,
        addStart: null,
        addEnd: null,
      },
    ],
  };
}

const currentReviewRules = {
  kind: "review",
  articles: {
    document: "html",
    oneArticlePer: "article.card",
    link: "a[href]",
    skipWhen: { selector: ".skip", match: null },
    nextPage: "a.next",
    limit: 20,
  },
  article: {
    canonicalUrl: null,
    title: {
      try: [
        {
          get: "text",
          selector: "h1.missing",
          take: "first",
          match: null,
          addStart: null,
          addEnd: null,
        },
        {
          get: "text",
          selector: "h1.title",
          take: "first",
          match: null,
          addStart: null,
          addEnd: null,
        },
      ],
    },
    publishedDate: {
      try: [
        {
          get: "attribute",
          selector: "time",
          attribute: "datetime",
          match: null,
          addStart: null,
          addEnd: null,
        },
      ],
    },
    reviews: {
      inside: ".entry-content",
      oneReviewPer: "section",
      startsAt: { selector: "h2.review", match: null },
      stopBefore: { selector: ".related", match: null },
      whenOnlyOneReview: "useWholeArea",
      name: reviewText("h2.review"),
      reviewer: {
        try: [
          {
            get: "text",
            from: "review",
            selector: ".writer",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
          {
            get: "text",
            from: "article",
            useFor: "everyReview",
            selector: ".byline",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
      tastingNotes: reviewText("p.note", "all"),
      score: {
        try: [
          {
            get: "text",
            from: "review",
            selector: ".score",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
          {
            get: "text",
            from: "article",
            useFor: "firstReview",
            selector: ".page-score",
            take: "first",
            match: null,
            addStart: null,
            addEnd: "/100",
          },
        ],
        scale: 100,
        map: null,
      },
    },
  },
} as const satisfies ScrapeRulesV9;

const dramfaceSavedRules = {
  kind: "review",
  articles: {
    document: "html",
    oneArticlePer: "article.blog-basic-grid--container",
    link: "h1.blog-title a[href]",
    skipWhen: null,
    nextPage: null,
    limit: 20,
  },
  article: {
    canonicalUrl: pageAttribute('link[rel="canonical"]', "href"),
    title: pageText(".blog-item-title"),
    publishedDate: pageAttribute('meta[itemprop="datePublished"]', "content"),
    reviews: {
      inside: "article.h-entry .blog-item-content > .sqs-layout > .row > .col",
      oneReviewPer: "section",
      startsAt: {
        selector: "h3",
        match: ["Review", "Review {anything}"],
      },
      stopBefore: { selector: "h3", match: ["Latest Reviews"] },
      whenOnlyOneReview: "useWholeArea",
      name: {
        try: [
          {
            get: "text",
            from: "review",
            selector: "p.sqsrte-large",
            take: "first",
            match: ["{value}{line}{anything}"],
            addStart: null,
            addEnd: null,
          },
          {
            get: "text",
            from: "review",
            selector: "p.sqsrte-large",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
      reviewer: {
        try: [
          {
            get: "text",
            from: "review",
            selector: "h3",
            take: "first",
            match: ["Review {anything} - {value}"],
            addStart: null,
            addEnd: null,
          },
          {
            get: "text",
            from: "article",
            useFor: "everyReview",
            selector: ".blog-author-name",
            take: "first",
            match: null,
            addStart: null,
            addEnd: null,
          },
        ],
      },
      tastingNotes: null,
      score: {
        try: [
          {
            get: "text",
            from: "review",
            selector: "h2, p",
            take: "first",
            match: ["Score: {value}/10", "Score: {value} / 10"],
            addStart: null,
            addEnd: "/10",
          },
        ],
        scale: 10,
        map: null,
      },
    },
  },
} as const satisfies ScrapeRulesV9;

const elementArticleRules = {
  ...currentReviewRules,
  articles: {
    document: "html",
    oneArticlePer: "body",
    link: "a[href]",
    skipWhen: null,
    nextPage: null,
    limit: 10,
  },
  article: {
    ...currentReviewRules.article,
    title: pageText("h1"),
    publishedDate: {
      try: [{ get: "dateFromUrl", format: "/yyyy/MM/dd/example.html" }],
    },
    reviews: {
      inside: "body",
      oneReviewPer: "element",
      selector: "article.review",
      contains: null,
      name: reviewText("h2"),
      reviewer: null,
      tastingNotes: null,
      score: {
        try: [
          {
            get: "text",
            from: "review",
            selector: ".score",
            take: "first",
            match: ["{value} points"],
            addStart: null,
            addEnd: " points",
          },
        ],
        scale: 100,
        map: null,
      },
    },
  },
} as const satisfies ScrapeRulesV9;

test("reads text links from an XML review index", () => {
  const rules = {
    ...currentReviewRules,
    articles: {
      document: "xml",
      oneArticlePer: "item",
      link: "link",
      skipWhen: {
        selector: "title",
        match: ["{anything}rum{anything}"],
      },
      nextPage: null,
      limit: 20,
    },
  } as const satisfies ScrapeRulesV9;

  expect(
    parseScrapeList(
      rules,
      `
        <rss><channel>
          <item>
            <title>A little trio of malts</title>
            <link>https://reviews.test/2026/malts.html</link>
          </item>
          <item>
            <title>A few rums</title>
            <link>https://reviews.test/2026/rums.html</link>
          </item>
        </channel></rss>
      `,
      new URL("https://reviews.test/whatsnew.xml"),
    ),
  ).toEqual({
    links: ["https://reviews.test/2026/malts.html"],
    nextPageUrl: null,
    issues: [],
  });
});

test("reads formatted dates from attributes and filters review elements", () => {
  const rules = {
    ...elementArticleRules,
    article: {
      ...elementArticleRules.article,
      publishedDate: {
        try: [
          {
            get: "dateFromAttribute",
            selector: "a[name]",
            attribute: "name",
            format: "ddMMyy",
          },
        ],
      },
      reviews: {
        ...elementArticleRules.article.reviews,
        selector: "article",
        contains: "h2",
      },
    },
  } as const satisfies ScrapeRulesV9;

  const result = parseScrapeDetail(
    rules,
    `
      <a name="070926"></a><h1>September seven</h1>
      <article><p>Introduction</p></article>
      <article><h2>Example Malt</h2><span class="score">88 points</span></article>
    `,
    new URL("https://reviews.test/2026/example.html"),
  );

  expect(result).toMatchObject({
    kind: "review",
    issues: [],
    value: {
      article: {
        publishedAt: new Date("2026-09-07T00:00:00.000Z"),
        externalReviews: [{ name: "Example Malt" }],
      },
    },
  });
});

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

  it("requests UK prices from GlenAllachie product pages", () => {
    const rules = {
      kind: "price",
      products: {
        oneProductPer: "article.product",
        link: "a[href]",
        skipWhen: null,
        nextPage: null,
        limit: 20,
      },
      product: {
        name: pageText("h1"),
        price: pageText(".price"),
        currency: "gbp",
        volume: pageText(".volume"),
        url: null,
        externalProductId: null,
        imageUrl: null,
        barcode: null,
      },
    } as const satisfies ScrapeRulesV9;

    expect(
      parseScrapeList(
        rules,
        '<article class="product"><a href="/products/glenallachie-12">Bottle</a></article>',
        new URL("https://shop.theglenallachie.com/collections/all-products"),
      ),
    ).toEqual({
      links: [
        "https://shop.theglenallachie.com/products/glenallachie-12?country=GB",
      ],
      nextPageUrl: null,
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

  it("matches the current Words of Whisky article links", async () => {
    const pageUrl = new URL("https://wordsofwhisky.com/");
    const html = await loadFixture("wordsofwhisky", "index.html");
    const legacyLinks = discoverWordsOfWhiskyArticles(html).map(
      (url) => url.href,
    );

    expect(
      parseScrapeList(wordsOfWhiskyRules, html, pageUrl).links.map((url) =>
        url.replace(/\/$/u, ""),
      ),
    ).toEqual(legacyLinks);
  });

  it("matches the current WhiskyNotes article links", async () => {
    const pageUrl = new URL("https://www.whiskynotes.be/");
    const html = await loadFixture("whiskynotes", "archive.html");
    const legacyLinks = discoverWhiskyNotesArticles(html).map(
      (url) => url.href,
    );

    expect(parseScrapeList(whiskyNotesRules, html, pageUrl)).toEqual({
      links: legacyLinks,
      nextPageUrl: "https://www.whiskynotes.be/page/2/",
      issues: [],
    });
  });

  it.each([
    [
      "single-review.html",
      "https://www.dramface.com/all-reviews/2026/springbank-12-cask-strength-2026",
    ],
    [
      "multi-bottle.html",
      "https://www.dramface.com/all-reviews/2026/impex-duo-isle-of-raasay-ardmore",
    ],
    [
      "multi-writer.html",
      "https://www.dramface.com/all-reviews/2026/ben-nevis-7yo-bedford-park",
    ],
  ])("matches Dramface review facts for %s", async (fixture, url) => {
    const html = await loadFixture("dramface", fixture);
    const pageUrl = new URL(url);
    const legacy = parseDramfaceArticle(html, pageUrl);
    const configured = parseScrapeDetail(dramfaceSavedRules, html, pageUrl);

    expect(configured.kind).toBe("review");
    expect(configured.issues).toEqual([]);
    if (configured.kind !== "review" || !configured.value) {
      throw new Error("Expected configured Dramface reviews.");
    }
    expect(configured.value.article).toMatchObject({
      canonicalUrl: legacy.article.canonicalUrl,
      title: legacy.article.title,
    });
    expect(
      configured.value.article.publishedAt.toISOString().slice(0, 10),
    ).toBe(legacy.article.publishedAt.toISOString().slice(0, 10));
    expect(configured.value.article.externalReviews).toMatchObject(
      legacy.article.externalReviews.map((review) => ({
        name: review.name,
        reviewerName: review.reviewerName,
        nativeScore: review.nativeScore,
      })),
    );
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

  it("parses an ordinal published date", () => {
    const result = parseScrapeDetail(
      {
        ...currentReviewRules,
        article: {
          ...currentReviewRules.article,
          publishedDate: pageText("time"),
        },
      },
      '<h1 class="title">Review</h1><time>January 29th, 2024</time><div class="entry-content"><h2 class="review">Example 12 Year</h2><p>Rich and balanced.</p></div>',
      new URL("https://reviews.test/example"),
    );

    expect(result.issues).toEqual([]);
    if (result.kind !== "review" || !result.value) {
      throw new Error("Expected configured review output.");
    }
    expect(result.value.article.publishedAt.toISOString().slice(0, 10)).toBe(
      "2024-01-29",
    );
  });

  it.each([
    ["is missing", "", "Required value was not found."],
    [
      "points to another website",
      '<link rel="canonical" href="https://other.test/review">',
      "Pages must stay on the source website.",
    ],
  ])(
    "reports one canonical URL issue when the configured value %s",
    (_, canonicalMarkup, message) => {
      const result = parseScrapeDetail(
        {
          ...reviewConfig,
          detail: {
            ...reviewConfig.detail,
            canonicalUrl: {
              selector: 'link[rel="canonical"]',
              attribute: "href",
            },
          },
        },
        `${canonicalMarkup}<h1>Review</h1><time datetime="2026-04-02"></time><article class="review"><h2>Example</h2></article>`,
        new URL("https://reviews.test/review"),
      );

      expect(result.kind).toBe("review");
      expect(result.value).toBeNull();
      expect(
        result.issues.filter(({ field }) => field === "detail.canonicalUrl"),
      ).toEqual([{ field: "detail.canonicalUrl", message }]);
    },
  );

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

  it.each(["single-review.html", "multi-review.html"])(
    "matches the current Words of Whisky parser for %s",
    async (fixture) => {
      const url = new URL(
        fixture === "single-review.html"
          ? "https://wordsofwhisky.com/bruichladdich-greener-still-review"
          : "https://wordsofwhisky.com/kanosuke-dingle-meikle-toir-the-whisky-exchange",
      );
      const html = await loadFixture("wordsofwhisky", fixture);
      const legacy = parseWordsOfWhiskyArticle(html, url);
      const configured = parseScrapeDetail(wordsOfWhiskyRules, html, url);

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
      expect(configured.value.article.externalReviews).toMatchObject(
        legacy.article.externalReviews.map((review) => ({
          name: review.name,
          reviewerName: review.reviewerName,
          nativeScore: review.nativeScore,
        })),
      );
      expect(Object.values(configured.value.externalReviewTexts)).toEqual(
        Object.values(legacy.externalReviewTexts),
      );
      expect(Object.values(configured.value.externalReviewBodies)).toEqual(
        Object.values(legacy.externalReviewBodies),
      );
    },
  );

  it.each([
    [
      "single-review.html",
      "https://www.whiskynotes.be/2026/world/kanekou-okinawa-whisky/",
    ],
    [
      "multi-review.html",
      "https://www.whiskynotes.be/2026/bowmore/bowmore-2005-ben-nevis-1996-whisky-agency/",
    ],
  ])("matches the current WhiskyNotes parser for %s", async (fixture, url) => {
    const html = await loadFixture("whiskynotes", fixture);
    const pageUrl = new URL(url);
    const legacy = parseWhiskyNotesArticle(html, pageUrl);
    const configured = parseScrapeDetail(whiskyNotesRules, html, pageUrl);

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
    expect(configured.value.article.externalReviews).toMatchObject(
      legacy.article.externalReviews.map((review) => ({
        name: review.name,
        reviewerName: review.reviewerName,
        nativeScore: review.nativeScore,
      })),
    );
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

  it("stops review sections at the next heading or end selector", () => {
    const result = parseScrapeDetail(
      {
        ...reviewConfig,
        detail: {
          ...reviewConfig.detail,
          reviewItem: {
            start: ".reviews > h2.review",
            endBefore: ".reviews > .related",
          },
          name: { selector: "h2.review" },
          reviewText: { selector: "p.notes" },
          score: undefined,
        },
      },
      `<h1>Two reviews</h1><time datetime="2026-09-01"></time>
      <div class="reviews">
        <h2 class="review">First Bottle</h2><p class="notes">Nose: fruit.</p>
        <h2 class="review">Second Bottle</h2><p class="notes">Palate: smoke.</p>
        <div class="related">Related reviews</div>
      </div>`,
      new URL("https://reviews.test/sections"),
    );

    expect(result.issues).toEqual([]);
    if (result.kind !== "review" || !result.value) {
      throw new Error("Expected reviews");
    }
    const [first, second] = result.value.article.externalReviews;
    expect(result.value.externalReviewBodies).toEqual({
      [first.sourceKey]: "First Bottle\n\nNose: fruit.",
      [second.sourceKey]: "Second Bottle\n\nPalate: smoke.",
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

  it("parses a catalog product without a review or price", () => {
    const field = (selector: string, attribute?: string) => ({
      try: [
        attribute
          ? {
              get: "attribute" as const,
              selector,
              attribute,
              match: null,
              addStart: null,
              addEnd: null,
            }
          : {
              get: "text" as const,
              selector,
              take: "first" as const,
              match: null,
              addStart: null,
              addEnd: null,
            },
      ],
    });
    const result = parseScrapeDetail(
      {
        kind: "catalog",
        products: {
          oneProductPer: "article.product",
          link: "a[href]",
          skipWhen: null,
          nextPage: null,
          limit: 25,
        },
        product: {
          name: field("h1"),
          url: field('link[rel="canonical"]', "href"),
          externalProductId: field("[data-product-id]", "data-product-id"),
          imageUrl: field('meta[property="og:image"]', "content"),
          volume: field(".volume"),
          abv: field(".abv"),
          statedAge: field(".age"),
          edition: field(".edition"),
          releaseYear: field(".release-year"),
        },
      },
      `<link rel="canonical" href="/whisky/example">
       <meta property="og:image" content="https://cdn.example.com/example.jpg">
       <main data-product-id="official-42">
         <h1>Example Official Release</h1>
         <span class="volume">70 cl</span>
         <span class="abv">46% ABV</span>
         <span class="age">12 years old</span>
         <span class="edition">Autumn Edition</span>
         <span class="release-year">Released 2026</span>
         <p class="description">Long producer description is not retained.</p>
       </main>`,
      new URL("https://distillery.test/whisky/example?region=us"),
    );

    expect(result).toMatchObject({
      kind: "catalog",
      issues: [],
      value: [
        {
          externalProductId: "official-42",
          name: "Example Official Release",
          url: "https://distillery.test/whisky/example",
          imageUrl: "https://cdn.example.com/example.jpg",
          volume: 700,
          sourceBottleIdentity: {
            stated_age: 12,
            abv: 46,
            edition: "Autumn Edition",
            release_year: 2026,
          },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("producer description");
  });

  it("reports a missing catalog product name", () => {
    const result = parseScrapeDetail(
      {
        kind: "catalog",
        products: {
          oneProductPer: "article.product",
          link: "a[href]",
          skipWhen: null,
          nextPage: null,
          limit: 25,
        },
        product: {
          name: {
            try: [
              {
                get: "text",
                selector: "h1",
                take: "first",
                match: null,
                addStart: null,
                addEnd: null,
              },
            ],
          },
          url: null,
          externalProductId: null,
          imageUrl: null,
          volume: null,
          abv: null,
          statedAge: null,
          edition: null,
          releaseYear: null,
        },
      },
      "<main><p>No title</p></main>",
      new URL("https://distillery.test/whisky/missing"),
    );

    expect(result).toMatchObject({ kind: "catalog", value: [] });
    expect(result.issues.map(({ field }) => field)).toEqual(["product.name"]);
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

  it("reads version 8 article links inside each result", () => {
    const result = parseScrapeList(
      currentReviewRules,
      `<main>
        <article class="card"><a href="/one">One</a></article>
        <article class="card"><span class="skip"></span><a href="/news">News</a></article>
        <article class="card"><a href="/two">Two</a></article>
        <a class="next" href="/page/2">Next</a>
      </main>`,
      new URL("https://reviews.test/"),
    );

    expect(result).toEqual({
      links: ["https://reviews.test/one", "https://reviews.test/two"],
      nextPageUrl: "https://reviews.test/page/2",
      issues: [],
    });
  });

  it("accepts a list page where every result is explicitly skipped", () => {
    const result = parseScrapeList(
      currentReviewRules,
      `<main>
        <article class="card"><span class="skip">News</span><a href="/news">News</a></article>
        <article class="card"><span class="skip">Interview</span><a href="/interview">Interview</a></article>
      </main>`,
      new URL("https://reviews.test/"),
    );

    expect(result).toEqual({
      links: [],
      nextPageUrl: null,
      issues: [],
    });
  });

  it("still reports when a saved result selector finds nothing", () => {
    expect(
      parseScrapeList(
        currentReviewRules,
        "<main></main>",
        new URL("https://reviews.test/"),
      ),
    ).toEqual({
      links: [],
      nextPageUrl: null,
      issues: [
        {
          field: "articles.link",
          message: "No links were found.",
        },
      ],
    });
  });

  it("reads version 8 review sections and explicit article values", () => {
    const result = parseScrapeDetail(
      currentReviewRules,
      `<article>
        <h1 class="title">Two autumn reviews</h1>
        <time datetime="2026-09-01"></time>
        <span class="byline">Example Writer</span>
        <span class="page-score">91</span>
        <div class="entry-content">
          <div class="layout-block"><p>Article introduction.</p></div>
          <div class="layout-block"><h2 class="review">North Coast 12</h2></div>
          <div class="layout-block"><p class="note">Nose: orange.</p></div>
          <div class="layout-block"><h2 class="review">Harbor Malt 18</h2></div>
          <div class="layout-block"><span class="writer">Second Writer</span></div>
          <div class="layout-block"><p class="note">Finish: oak.</p></div>
          <div class="layout-block"><span class="score">88/100</span></div>
          <div class="layout-block"><aside class="related">Related reviews</aside></div>
        </div>
      </article>`,
      new URL("https://reviews.test/autumn"),
    );

    expect(result.issues).toEqual([]);
    expect(result.kind).toBe("review");
    if (result.kind !== "review" || !result.value) {
      throw new Error("Expected parsed reviews.");
    }
    expect(result.value.article.externalReviews).toMatchObject([
      {
        name: "North Coast 12",
        reviewerName: "Example Writer",
        nativeScore: { value: 91, scale: 100, display: "91/100" },
      },
      {
        name: "Harbor Malt 18",
        reviewerName: "Second Writer",
        nativeScore: { value: 88, scale: 100, display: "88/100" },
      },
    ]);
    expect(Object.values(result.value.externalReviewBodies)[0]).not.toContain(
      "Article introduction.",
    );
    expect(Object.values(result.value.externalReviewBodies)[1]).not.toContain(
      "Related reviews",
    );
  });

  it("keeps reviews matched when they move", () => {
    const parseKeys = (reviews: string) => {
      const result = parseScrapeDetail(
        currentReviewRules,
        `<article>
          <h1 class="title">Reviews</h1>
          <time datetime="2026-09-01"></time>
          <span class="byline">Example Writer</span>
          <div class="entry-content">${reviews}</div>
        </article>`,
        new URL("https://reviews.test/reviews"),
      );
      if (result.kind !== "review" || !result.value) {
        throw new Error("Expected parsed reviews.");
      }
      return Object.fromEntries(
        result.value.article.externalReviews.map(({ name, sourceKey }) => [
          name,
          sourceKey,
        ]),
      );
    };
    const northCoast =
      '<h2 class="review">North Coast 12</h2><p class="note">Orange.</p>';
    const harborMalt =
      '<h2 class="review">Harbor Malt 18</h2><p class="note">Oak.</p>';

    expect(parseKeys(northCoast + harborMalt)).toEqual(
      parseKeys(harborMalt + northCoast),
    );
  });

  it("keeps repeated reviews separate", () => {
    const result = parseScrapeDetail(
      currentReviewRules,
      `<article>
        <h1 class="title">Reviews</h1>
        <time datetime="2026-09-01"></time>
        <span class="byline">Example Writer</span>
        <div class="entry-content">
          <h2 class="review">North Coast 12</h2><p class="note">Orange.</p>
          <h2 class="review">North Coast 12</h2><p class="note">Oak.</p>
        </div>
      </article>`,
      new URL("https://reviews.test/reviews"),
    );
    if (result.kind !== "review" || !result.value) {
      throw new Error("Expected parsed reviews.");
    }
    const keys = result.value.article.externalReviews.map(
      ({ sourceKey }) => sourceKey,
    );

    expect(new Set(keys)).toHaveLength(2);
    expect(keys[1]).toBe(`${keys[0]}:2`);
  });

  it("can keep the full article area for one version 8 review", () => {
    const result = parseScrapeDetail(
      currentReviewRules,
      `<article>
        <h1 class="title">One autumn review</h1>
        <time datetime="2026-09-01"></time>
        <span class="byline">Example Writer</span>
        <span class="page-score">91</span>
        <div class="entry-content">
          <p>Article introduction.</p>
          <h2 class="review">North Coast 12</h2>
          <p class="note">Nose: orange.</p>
          <aside class="related">Related reviews</aside>
        </div>
      </article>`,
      new URL("https://reviews.test/autumn"),
    );

    expect(result.issues).toEqual([]);
    expect(result.kind).toBe("review");
    if (result.kind !== "review" || !result.value) {
      throw new Error("Expected a parsed review.");
    }
    const body = Object.values(result.value.externalReviewBodies)[0];
    expect(body).toContain("Article introduction.");
    expect(body).toContain("Nose: orange.");
    expect(body).not.toContain("Related reviews");
  });

  it("reports a version 8 review area that is not unique", () => {
    const result = parseScrapeDetail(
      currentReviewRules,
      `<h1 class="title">Reviews</h1>
       <time datetime="2026-09-01"></time>
       <div class="entry-content"><h2 class="review">One</h2></div>
       <div class="entry-content"><h2 class="review">Two</h2></div>`,
      new URL("https://reviews.test/autumn"),
    );

    expect(result).toMatchObject({
      kind: "review",
      value: null,
      issues: [
        {
          field: "article.reviews.inside",
          message: "The review area must match exactly once.",
        },
      ],
    });
  });

  it("reads a version 8 product page", () => {
    const rules = {
      kind: "price",
      products: {
        oneProductPer: "article.product",
        link: "a[href]",
        skipWhen: null,
        nextPage: null,
        limit: 20,
      },
      product: {
        name: pageText("h1"),
        price: {
          try: [
            {
              get: "text",
              selector: ".sale-price",
              take: "first",
              match: null,
              addStart: null,
              addEnd: null,
            },
            {
              get: "text",
              selector: ".price",
              take: "first",
              match: null,
              addStart: null,
              addEnd: null,
            },
          ],
        },
        currency: "usd",
        volume: pageText(".volume"),
        url: null,
        externalProductId: pageText(".sku"),
        imageUrl: pageAttribute("img.bottle", "src"),
        barcode: null,
      },
    } as const satisfies ScrapeRulesV9;

    expect(
      parseScrapeDetail(
        rules,
        `<h1>Coastal Malt</h1>
         <span class="price">$84.99</span>
         <span class="volume">70 cl</span>
         <span class="sku">COASTAL-70</span>
         <img class="bottle" src="https://store.test/images/coastal.jpg">`,
        new URL("https://store.test/products/coastal"),
      ),
    ).toEqual({
      kind: "price",
      value: [
        {
          name: "Coastal Malt",
          price: 8499,
          currency: "usd",
          volume: 700,
          url: "https://store.test/products/coastal",
          externalProductId: "COASTAL-70",
          imageUrl: "https://store.test/images/coastal.jpg",
        },
      ],
      issues: [],
    });
  });
});
