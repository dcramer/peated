import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type Metadata } from "next";
import SearchResults from "./results";

const maxResults = 50;

export const metadata: Metadata = {
  title: "Search",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, any>;
}) {
  const user = await getCurrentUser();

  const query = searchParams.q ?? "";
  const directToTasting = searchParams.tasting !== undefined;

  const isUserQuery = query.indexOf("@") !== -1 && user;

  const include: ("bottles" | "entities" | "users")[] = [];
  if (directToTasting || !isUserQuery) include.push("bottles");
  if (!directToTasting && user && (isUserQuery || query)) include.push("users");
  if (!directToTasting) include.push("entities");

  const trpcClient = await getTrpcClient();
  const { results } = await trpcClient.search.fetch({
    query,
    limit: maxResults,
    include,
  });

  return (
    <SearchResults
      results={results}
      query={query}
      directToTasting={directToTasting}
    />
  );
}
