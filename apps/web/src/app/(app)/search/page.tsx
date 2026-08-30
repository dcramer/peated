import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

import { SearchPageClient } from "./searchPageClient.stylex";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Peated whisky database.",
};

export default async function SearchPage() {
  const { client } = await getPublicPageServerClient();
  const stats = await client.stats();

  return <SearchPageClient bottleTotal={stats.bottles} />;
}
