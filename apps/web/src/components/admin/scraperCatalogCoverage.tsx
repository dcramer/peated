import type { Outputs } from "@peated/server/orpc/router";

type Coverage = Outputs["admin"]["catalogCoverage"];

function percentage(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function CoverageCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-muted text-xs font-semibold uppercase tracking-wide">
        {title}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="text-muted mt-2 text-xs leading-5">{children}</div>
    </div>
  );
}

export default function ScraperCatalogCoverage({
  coverage,
}: {
  coverage: Coverage;
}) {
  return (
    <section aria-labelledby="catalog-coverage-heading" className="mb-6">
      <h2
        id="catalog-coverage-heading"
        className="mb-3 text-lg font-semibold text-white"
      >
        Catalog coverage
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <CoverageCard
          title="Active bottles"
          value={coverage.bottles.total.toLocaleString("en-US")}
        >
          {percentage(coverage.bottles.withDescription, coverage.bottles.total)}{" "}
          described ·{" "}
          {percentage(coverage.bottles.withImage, coverage.bottles.total)}{" "}
          pictured
          <br />
          {percentage(
            coverage.bottles.withReviews,
            coverage.bottles.total,
          )}{" "}
          with reviews ·{" "}
          {percentage(
            coverage.bottles.withPriceListings,
            coverage.bottles.total,
          )}{" "}
          with prices
        </CoverageCard>
        <CoverageCard
          title="Visible reviews"
          value={coverage.reviews.total.toLocaleString("en-US")}
        >
          {coverage.reviews.matched.toLocaleString("en-US")} matched ·{" "}
          {coverage.reviews.unmatched.toLocaleString("en-US")} unmatched
        </CoverageCard>
        <CoverageCard
          title="Visible prices"
          value={coverage.priceListings.total.toLocaleString("en-US")}
        >
          {coverage.priceListings.matched.toLocaleString("en-US")} matched ·{" "}
          {coverage.priceListings.unmatched.toLocaleString("en-US")} unmatched
        </CoverageCard>
      </div>
    </section>
  );
}
