import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

import { EntityCatalogPage } from "../entityCatalogPage";

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return getCatalogSeoMetadata(
    {
      title: "Whisky distilleries",
      description: "Browse whisky distilleries and the bottles they make.",
      url: "/distillers",
    },
    await props.searchParams,
  );
}

export default function DistillerListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <EntityCatalogPage kind="distillery" searchParams={props.searchParams} />
  );
}
