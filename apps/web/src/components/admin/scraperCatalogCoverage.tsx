import type { Outputs } from "@peated/server/orpc/router";

import { AdminSection, AdminStat, AdminStatGrid } from "./adminContent.stylex";

type Coverage = Outputs["admin"]["catalogCoverage"];

function percentage(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

export default function ScraperCatalogCoverage({
  coverage,
}: {
  coverage: Coverage;
}) {
  return (
    <AdminSection title="Catalog coverage">
      <AdminStatGrid>
        <AdminStat
          label="Active bottles"
          value={coverage.bottles.total.toLocaleString("en-US")}
          detail={`${percentage(coverage.bottles.withDescription, coverage.bottles.total)} described · ${percentage(coverage.bottles.withImage, coverage.bottles.total)} pictured · ${percentage(coverage.bottles.withReviews, coverage.bottles.total)} with reviews · ${percentage(coverage.bottles.withPriceListings, coverage.bottles.total)} with prices`}
        />
        <AdminStat
          label="Visible reviews"
          value={coverage.externalReviews.total.toLocaleString("en-US")}
          detail={`${coverage.externalReviews.matched.toLocaleString("en-US")} matched · ${coverage.externalReviews.unmatched.toLocaleString("en-US")} unmatched`}
        />
        <AdminStat
          label="Visible prices"
          value={coverage.priceListings.total.toLocaleString("en-US")}
          detail={`${coverage.priceListings.matched.toLocaleString("en-US")} matched · ${coverage.priceListings.unmatched.toLocaleString("en-US")} unmatched`}
        />
      </AdminStatGrid>
    </AdminSection>
  );
}
