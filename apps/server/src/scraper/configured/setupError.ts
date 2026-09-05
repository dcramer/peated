import type { ScrapeIssue } from "./preview";

const SETUP_FIELD_LABELS = {
  kind: "Content type",
  listPageUrl: "Collection page",
  "list.detailLink": "Item links",
  "list.nextPage": "Next page",
  "articles.link": "Article links",
  "articles.nextPage": "Next page",
  "products.link": "Product links",
  "products.nextPage": "Next page",
  detail: "Item page",
  "detail.title": "Page title",
  "detail.publishedAt": "Published date",
  "detail.reviewItem": "Reviews",
  "detail.name": "Item name",
  "detail.reviewerName": "Reviewer name",
  "detail.reviewText": "Review text",
  "detail.score": "Score",
  "detail.price": "Price",
  "detail.currency": "Currency",
  "detail.volume": "Bottle size",
  "detail.url": "Product link",
  "detail.externalProductId": "Product ID",
  "detail.imageUrl": "Image",
  "detail.barcode": "Barcode",
  article: "Article page",
  "article.canonicalUrl": "Preferred article link",
  "article.title": "Article title",
  "article.publishedDate": "Published date",
  "article.reviews": "Reviews",
  "article.reviews.inside": "Review area",
  "article.reviews.selector": "Individual reviews",
  "article.reviews.name": "Bottle name",
  "article.reviews.reviewer": "Reviewer name",
  "article.reviews.tastingNotes": "Tasting notes",
  "article.reviews.score": "Score",
  product: "Product page",
  "product.name": "Product name",
  "product.price": "Price",
  "product.currency": "Currency",
  "product.volume": "Bottle size",
  "product.url": "Product link",
  "product.externalProductId": "Product ID",
  "product.imageUrl": "Image",
  "product.barcode": "Barcode",
  output: "AI response",
};

function setupFieldLabel(field: string) {
  const pageField = field.startsWith("rules.")
    ? field.slice("rules.".length)
    : field;
  const exactLabel = Object.entries(SETUP_FIELD_LABELS).find(
    ([key]) => key === pageField,
  )?.[1];
  if (exactLabel) return exactLabel;
  return (
    Object.entries(SETUP_FIELD_LABELS)
      .filter(([key]) => pageField.startsWith(`${key}.`))
      .sort(([left], [right]) => right.length - left.length)[0]?.[1] ??
    "Page content"
  );
}

export type ScrapeSourceSetupFeedback = {
  message: string;
  issues: ScrapeIssue[];
};

/** Expected page-rule failures are repair input, not system failures. */
export class ScrapeSourceSetupError extends Error {
  override name = "ScrapeSourceSetupError";

  constructor(
    // Keep this fixed and safe to show to admins and in telemetry.
    readonly summary: string,
    readonly issues: ScrapeIssue[] = [],
  ) {
    const details = issues
      .slice(0, 3)
      .map((issue) => `${issue.field}: ${issue.message}`)
      .join(" ");
    super(details ? `${summary} ${details}` : summary);
  }

  feedback(): ScrapeSourceSetupFeedback {
    return { message: this.summary, issues: this.issues };
  }

  adminMessage() {
    const fields = [
      ...new Set(
        this.issues.slice(0, 3).map(({ field }) => setupFieldLabel(field)),
      ),
    ];
    return fields.length > 0
      ? `AI setup stopped. ${this.summary} Check: ${fields.join(", ")}.`
      : `AI setup stopped. ${this.summary}`;
  }
}
