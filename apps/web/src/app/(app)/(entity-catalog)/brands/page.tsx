import type { Metadata } from "next";

import { EntityCatalogPage } from "../entityCatalogPage";

export const metadata: Metadata = {
  title: "Whisky Brands",
  description: "Browse whisky brands recorded in the Peated database.",
};

export default function BrandListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="brand" searchParams={props.searchParams} />;
}
