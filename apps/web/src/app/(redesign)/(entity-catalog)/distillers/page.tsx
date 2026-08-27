import type { Metadata } from "next";

import { EntityCatalogPageClient } from "../entityCatalogPageClient";

export const metadata: Metadata = {
  title: "Whisky Distillers",
  description: "Browse whisky distillers recorded in the Peated database.",
};

export default function DistillerListPage() {
  return <EntityCatalogPageClient type="distiller" />;
}
