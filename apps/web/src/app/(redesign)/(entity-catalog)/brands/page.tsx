import type { Metadata } from "next";

import { EntityCatalogPageClient } from "../entityCatalogPageClient";

export const metadata: Metadata = {
  title: "Whisky Brands",
  description: "Browse whisky brands recorded in the Peated database.",
};

export default function BrandListPage() {
  return <EntityCatalogPageClient kind="brand" />;
}
