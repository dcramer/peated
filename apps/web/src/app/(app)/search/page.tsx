import type { Metadata } from "next";

import { SearchPageClient } from "./searchPageClient.stylex";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Peated whisky database.",
};

export default function SearchPage() {
  return <SearchPageClient />;
}
