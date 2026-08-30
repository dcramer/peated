import type { Metadata } from "next";

import { EntityCatalogPage } from "../entityCatalogPage";

export const metadata: Metadata = {
  title: "Whisky Blenders",
  description: "Browse whisky blenders recorded in the Peated database.",
};

export default function BlenderListPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EntityCatalogPage kind="blender" searchParams={props.searchParams} />;
}
