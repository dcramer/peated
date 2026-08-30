import type { Metadata } from "next";

import { EntityCatalogPage } from "../entityCatalogPage";

export const metadata: Metadata = {
  title: "Whisky Distillers",
  description: "Browse whisky distillers recorded in the Peated database.",
};

export default function DistillerListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <EntityCatalogPage kind="distillery" searchParams={props.searchParams} />
  );
}
