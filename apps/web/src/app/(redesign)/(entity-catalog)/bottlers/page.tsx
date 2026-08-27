import type { Metadata } from "next";

import { EntityCatalogPageClient } from "../entityCatalogPageClient";

export const metadata: Metadata = {
  title: "Whisky Bottlers",
  description: "Browse whisky bottlers recorded in the Peated database.",
};

export default function BottlerListPage() {
  return <EntityCatalogPageClient type="bottler" />;
}
