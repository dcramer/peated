import type { Metadata } from "next";

import { BottleCatalogPageClient } from "./bottleCatalogPageClient";

export const metadata: Metadata = {
  title: "Whisky Bottles",
  description: "Browse whisky bottles recorded in the Peated database.",
};

export default function BottleListPage() {
  return <BottleCatalogPageClient />;
}
