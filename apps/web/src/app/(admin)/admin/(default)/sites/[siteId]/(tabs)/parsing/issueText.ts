const FIELD_LABELS = {
  "list.detailLink": "Item links",
  "list.nextPage": "Next page",
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
};

export default function issueText(field: string) {
  const knownLabel = Object.entries(FIELD_LABELS).find(
    ([key]) => key === field,
  )?.[1];
  const label = field.includes(".name")
    ? "Item name"
    : field.includes(".score")
      ? "Score"
      : (knownLabel ?? "Page details");
  return `${label}: Peated could not read this part of the page.`;
}
