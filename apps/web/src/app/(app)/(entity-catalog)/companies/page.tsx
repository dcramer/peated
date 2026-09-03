import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

import { EntityCatalogPage } from "../entityCatalogPage";

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return getCatalogSeoMetadata(
    {
      title: "Whisky companies",
      description: "Browse whisky companies recorded in the Peated database.",
      url: "/companies",
    },
    await props.searchParams,
  );
}

export default function CompanyListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="company" searchParams={props.searchParams} />;
}
