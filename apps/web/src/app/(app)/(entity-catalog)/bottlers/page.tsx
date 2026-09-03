import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";

import { EntityCatalogPage } from "../entityCatalogPage";

export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return getCatalogSeoMetadata(
    {
      title: "Whisky bottlers",
      description: "Browse whisky bottlers recorded in the Peated database.",
      url: "/bottlers",
    },
    await props.searchParams,
  );
}

export default function BottlerListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="bottler" searchParams={props.searchParams} />;
}
