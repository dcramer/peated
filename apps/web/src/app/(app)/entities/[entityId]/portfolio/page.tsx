import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPageCompanyPortfolio } from "@peated/web/lib/publicCatalog.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getEntityUrl } from "@peated/web/lib/urls";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompanyPortfolioClient } from "./companyPortfolioClient.stylex";
import { getCompanyPortfolioInput } from "./companyPortfolioParams";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ entityId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  return getCatalogSeoMetadata(
    {
      title: `${entity.name} whisky portfolio`,
      description: `Browse brands, distilleries, and bottlers connected to ${entity.name}.`,
      url: `${getEntityUrl(entity)}/portfolio`,
    },
    searchParams,
  );
}

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
