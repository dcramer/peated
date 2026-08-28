import type { Metadata } from "next";

import { EntityCatalogPage } from "../entityCatalogPage";

export const metadata: Metadata = {
  title: "Whisky Companies",
  description: "Browse whisky companies recorded in the Peated database.",
};

export default function CompanyListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="company" searchParams={props.searchParams} />;
}
