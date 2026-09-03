import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

import { EntityCatalogPage } from "../entityCatalogPage";

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return getCatalogSeoMetadata(
    {
      title: "Whisky brands",
      description: "Browse whisky brands recorded in the Peated database.",
      url: "/brands",
    },
    await props.searchParams,
  );
}

export default function BrandListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="brand" searchParams={props.searchParams} />;
}
