import type { Outputs } from "@peated/server/orpc/router";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];
type Revision = Source["revisions"][number];

export default function PreviewResult({ revision }: { revision: Revision }) {
  const { issues, pages } = revision.previewResult;
  return (
    <div className="mt-4 space-y-3 rounded bg-slate-950 p-3 text-sm text-slate-300">
      {issues.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-red-300">
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`}>
              {issue.field}: {issue.message}
            </li>
          ))}
        </ul>
      )}
      {pages.map((page) => (
        <div
          key={page.url}
          className="border-t border-slate-800 pt-3 first:border-0 first:pt-0"
        >
          <a className="break-all text-cyan-300" href={page.url}>
            {page.url}
          </a>
          {page.kind === "review" ? (
            <div className="mt-2">
              <div className="font-medium text-white">{page.title}</div>
              <div className="text-muted mt-1">
                {page.reviews.length} review
                {page.reviews.length === 1 ? "" : "s"}
              </div>
              <ul className="mt-2 space-y-1">
                {page.reviews.map((review, index) => (
                  <li key={`${review.name}-${index}`}>
                    {review.name}
                    {review.reviewerName ? ` · ${review.reviewerName}` : ""}
                    {review.nativeScore !== null
                      ? ` · score ${review.nativeScore.display}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="mt-2 space-y-1">
              {page.products.map((product, index) => (
                <li key={`${product.url}-${index}`}>
                  {product.name} ·{" "}
                  {(product.price / 100).toLocaleString(undefined, {
                    style: "currency",
                    currency: product.currency,
                  })}{" "}
                  · {product.volume} ml
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
