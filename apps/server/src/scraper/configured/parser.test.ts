import { describe, expect, it } from "vitest";
import { parseScrapeDetail, parseScrapeList } from "./parser";

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

describe("scrape source parser", () => {
  it("extracts bounded, same-origin detail links", () => {
    const result = parseScrapeList(
      reviewConfig,
      '<a class="review" href="/one">One</a><a class="review" href="https://reviews.test/two#top">Two</a><a class="review" href="/three">Three</a>',
      new URL("https://reviews.test/archive"),
    );
    expect(result).toEqual({
      links: ["https://reviews.test/one", "https://reviews.test/two"],
      issues: [],
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
      "Detail pages must use the same website as the list page.",
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

  it("extracts repeated reviews and reports invalid dates and scores", () => {
    const result = parseScrapeDetail(
      reviewConfig,
      '<h1>Spring reviews</h1><time datetime="not-a-date"></time><article class="review"><h2>First Bottle</h2><span class="score">none</span></article><article class="review"><h2>Second Bottle</h2><span class="score">88</span></article>',
      new URL("https://reviews.test/spring"),
    );
    expect(result.kind).toBe("review");
    if (result.kind !== "review") throw new Error("Wrong kind");
    expect(result.value?.article.externalReviews).toHaveLength(2);
    expect(result.issues).toEqual([
      { field: "detail.publishedAt", message: "Date is not valid." },
      {
        field: "detail.reviewItem.0.score",
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
    expect(result.issues.length).toBeGreaterThan(0);
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
      "name",
      "price",
      "volume",
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
      issues: [
        {
          field: "list.detailLink",
          message: "The selector did not find any detail links.",
        },
      ],
    });
  });
});
