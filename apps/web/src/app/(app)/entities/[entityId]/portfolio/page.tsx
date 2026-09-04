import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPageCompanyPortfolio } from "@peated/web/lib/publicCatalog.server";
import { getEntityUrl } from "@peated/web/lib/urls";
import { redirect } from "next/navigation";

import { CompanyPortfolioClient } from "./companyPortfolioClient.stylex";
import { getCompanyPortfolioInput } from "./companyPortfolioParams";

export default async function CompanyPortfolioPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const searchParams = await props.searchParams;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  if (entity.kind !== "company") {
    redirect(getEntityUrl(entity));
  }

  const portfolio = await getPageCompanyPortfolio(
    getCompanyPortfolioInput(entity.id, searchParams),
  );
  if (!portfolio.totals.all) {
    redirect(getEntityUrl(entity));
  }

  return (
    <CompanyPortfolioClient
      companyId={entity.id}
      companyName={entity.name}
      initialPortfolio={portfolio}
    />
  );
}
