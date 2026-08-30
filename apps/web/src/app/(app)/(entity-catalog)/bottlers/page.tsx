import type { Metadata } from "next";

import { EntityCatalogPage } from "../entityCatalogPage";

export const metadata: Metadata = {
  title: "Whisky Bottlers",
  description: "Browse whisky bottlers recorded in the Peated database.",
};

export default function BottlerListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="bottler" searchParams={props.searchParams} />;
}
